import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PatientRecord } from "../repositories/patient-record.repository";
import {
  insertPatientRecord,
  findPatientRecordById,
  listPatientRecordsByPatient,
  countPatientRecordsByPatient,
  softDeletePatientRecord,
} from "../repositories/patient-record.repository";
import { findPatientById } from "../repositories/patient.repository";
import {
  canViewPatientRecords,
  canManagePatientRecords,
  canDeletePatientRecords,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { recordAuditLogSafe } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePatientRecordInput } from "../validators/patient-record.validator";

const STORAGE_BUCKET = "patient-records";
const SIGNED_URL_EXPIRY_SECONDS = 300;

export interface UploadedFile {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface PatientRecordWithDownloadUrl extends PatientRecord {
  downloadUrl: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Builds the Storage object path. Always server-computed from the resolved
 * organization/patient — never accepted from the client — since the
 * patient_records storage.objects RLS policies parse organization_id and
 * patient_id out of this path.
 */
function buildObjectPath(organizationId: string, patientId: string, fileName: string): string {
  return `${organizationId}/${patientId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

async function attachDownloadUrl(
  adminClient: SupabaseClient<Database>,
  record: PatientRecord
): Promise<PatientRecordWithDownloadUrl> {
  const { data, error } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(record.file_url, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    throw error;
  }
  return { ...record, downloadUrl: data.signedUrl };
}

/**
 * Uploads a patient record file to Storage and inserts its metadata row.
 * If the database insert fails after a successful upload, the uploaded
 * object is removed (compensating action).
 */
export async function createPatientRecord(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  input: CreatePatientRecordInput & UploadedFile
): Promise<PatientRecord> {
  const isAuthorized = await canManagePatientRecords(supabase, callerUserId, patientId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const patient = await findPatientById(supabase, patientId);
  if (!patient) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  // Gated on the patient's organization, not the caller's: unlike the other
  // gated create paths, this one never fetches the caller, and a SUPER_ADMIN
  // caller (admitted by canViewPatientRecords) has no organization of its own.
  // Same reason consumePackageSession derives its organization from the resource.
  // Runs before the upload so a rejected write never puts a file in Storage.
  await assertOrganizationCanTransact(supabase, patient.organization_id);

  const objectPath = buildObjectPath(patient.organization_id, patient.id, input.fileName);

  const { error: uploadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, input.fileBuffer, { contentType: input.mimeType, upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  let record: PatientRecord;
  try {
    record = await insertPatientRecord(supabase, {
      organization_id: patient.organization_id,
      patient_id: patient.id,
      uploaded_by: callerUserId,
      record_type: input.recordType,
      title: input.title,
      file_url: objectPath,
      notes: input.notes || null,
    });
  } catch (error) {
    try {
      await adminClient.storage.from(STORAGE_BUCKET).remove([objectPath]);
    } catch {
      // TODO: Introduce centralized monitoring/alerting for compensation failures.
    }
    throw error;
  }

  // Outside the try above: its catch compensates a failed insert by removing
  // the uploaded object, and the row exists by the time this runs.
  await recordAuditLogSafe(supabase, {
    organizationId: patient.organization_id,
    userId: callerUserId,
    action: "create",
    entityName: "patient_records",
    entityId: record.id,
    newData: record,
  });

  return record;
}

/**
 * Soft-deletes a patient record and removes its Storage object.
 *
 * The row is the audit trail; the file is the payload. Removing only the row
 * would leave a misfiled scan at <organization>/<wrong-patient>/... in a
 * bucket whose policies grant on the patient folder in the path -- still
 * reachable by exactly the people who should not see it. So the object goes
 * too, which makes the soft delete **not practically reversible**: the
 * retained row's file_url points at an object that no longer exists. The row
 * is kept for audit -- who uploaded what, and when it was removed -- not as a
 * restore point, and nothing in the product offers to restore it.
 *
 * The audit entry's old_data snapshot is therefore the only surviving trace
 * of the document, file_url included: it is what ties the entry to
 * storage-level logs and backups.
 *
 * Ordering is row first, then object. If the removal fails, the record is
 * already soft-deleted and an orphaned object remains -- a monitoring
 * concern, and the same asymmetry createPatientRecord's compensation path
 * already accepts. The inverse order is worse: a failed row update after a
 * successful removal leaves a live record pointing at a file that is gone.
 */
export async function deletePatientRecord(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  recordId: string
): Promise<PatientRecord> {
  const isAuthorized = await canDeletePatientRecords(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const patient = await findPatientById(supabase, patientId);
  if (!patient) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  // Resource-anchored for the same reason as createPatientRecord above.
  await assertOrganizationCanTransact(supabase, patient.organization_id);

  const record = await findPatientRecordById(supabase, recordId);
  if (!record || record.patient_id !== patientId) {
    throw new AppError("Patient record not found", ErrorCodes.NOT_FOUND);
  }

  const deleted = await softDeletePatientRecord(supabase, recordId);

  try {
    await adminClient.storage.from(STORAGE_BUCKET).remove([record.file_url]);
  } catch {
    // TODO: Introduce centralized monitoring/alerting for compensation failures.
  }

  await recordAuditLogSafe(supabase, {
    organizationId: patient.organization_id,
    userId: callerUserId,
    action: "delete",
    entityName: "patient_records",
    entityId: record.id,
    oldData: record,
  });

  return deleted;
}

/**
 * Lists a patient's records, each with a freshly generated short-lived
 * signed download URL.
 */
export async function listPatientRecords(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  filters: { page: number; limit: number }
): Promise<PagedResult<PatientRecordWithDownloadUrl>> {
  const isAuthorized = await canViewPatientRecords(supabase, callerUserId, patientId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const patient = await findPatientById(supabase, patientId);
  if (!patient) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  const records = await listPatientRecordsByPatient(supabase, patientId, filters);
  const total = await countPatientRecordsByPatient(supabase, patientId);
  const items = await Promise.all(records.map((record) => attachDownloadUrl(adminClient, record)));

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Fetches a single patient record with a freshly generated signed download URL.
 */
export async function getPatientRecordDetails(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  recordId: string
): Promise<PatientRecordWithDownloadUrl> {
  const isAuthorized = await canViewPatientRecords(supabase, callerUserId, patientId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const record = await findPatientRecordById(supabase, recordId);
  if (!record || record.patient_id !== patientId) {
    throw new AppError("Patient record not found", ErrorCodes.NOT_FOUND);
  }

  return attachDownloadUrl(adminClient, record);
}
