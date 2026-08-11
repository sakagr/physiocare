import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PatientRecord } from "../repositories/patient-record.repository";
import {
  insertPatientRecord,
  findPatientRecordById,
  listPatientRecordsByPatient,
  countPatientRecordsByPatient,
} from "../repositories/patient-record.repository";
import { findPatientById } from "../repositories/patient.repository";
import { canViewPatientRecords, canManagePatientRecords, assertOrganizationCanTransact } from "./authorization.service";
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

  try {
    return await insertPatientRecord(supabase, {
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
