import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Invoice } from "../repositories/invoice.repository";
import {
  insertInvoice,
  updateInvoice as persistInvoiceUpdate,
  deleteInvoice as removeInvoice,
  findInvoiceById,
  findLatestInvoiceNumberInOrg,
  listInvoices,
  countInvoices,
} from "../repositories/invoice.repository";
import {
  insertInvoiceItems,
  listInvoiceItemsByInvoice,
  deleteInvoiceItemsByInvoice,
  type InvoiceItem,
} from "../repositories/invoice-item.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findPatientById } from "../repositories/patient.repository";
import { findClinicById } from "../repositories/clinic.repository";
import { findAppointmentById } from "../repositories/appointment.repository";
import { findPatientPackageById } from "../repositories/patient-package.repository";
import { existsPaymentForInvoice } from "../repositories/payment.repository";
import {
  canViewInvoices,
  canManageInvoices,
  canAccessInvoice,
  canDeleteInvoice,
  getAccessibleClinicIds,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { recordAuditLog } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "../validators/invoice.validator";

const INVOICE_NUMBER_PREFIX = "INV-";
const INVOICE_NUMBER_DIGITS = 6;
const MAX_INVOICE_NUMBER_ATTEMPTS = 3;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}

/**
 * Generates the next sequential, immutable invoice number for an organization.
 * Considers soft-deleted invoices too, since numbers must never be reused.
 */
async function generateInvoiceNumber(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<string> {
  const latest = await findLatestInvoiceNumberInOrg(supabase, organizationId);
  const nextSequence = latest ? parseInt(latest.slice(INVOICE_NUMBER_PREFIX.length), 10) + 1 : 1;
  return `${INVOICE_NUMBER_PREFIX}${String(nextSequence).padStart(INVOICE_NUMBER_DIGITS, "0")}`;
}

interface InvoiceWithItems {
  invoice: Invoice;
  items: InvoiceItem[];
}

function computeTotals(items: CreateInvoiceInput["items"], discountAmount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const gstAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.gstPercent / 100), 0);
  const totalAmount = subtotal + gstAmount - discountAmount;
  return { subtotal, gstAmount, totalAmount };
}

/**
 * Creates a new invoice with its line items, generating an immutable
 * invoice number. Totals are computed by the service from the (validated)
 * items, the single source of truth.
 */
export async function createInvoice(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateInvoiceInput
): Promise<InvoiceWithItems> {
  const isAuthorized = await canManageInvoices(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const patient = await findPatientById(supabase, input.patientId);
  if (!patient || patient.organization_id !== caller.organization_id) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  const clinic = await findClinicById(supabase, input.clinicId);
  if (!clinic || clinic.organization_id !== caller.organization_id) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (input.appointmentId) {
    const appointment = await findAppointmentById(supabase, input.appointmentId);
    if (!appointment || appointment.organization_id !== caller.organization_id || appointment.patient_id !== input.patientId) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
    }
  }

  if (input.patientPackageId) {
    const patientPackage = await findPatientPackageById(supabase, input.patientPackageId);
    if (!patientPackage || patientPackage.organization_id !== caller.organization_id || patientPackage.patient_id !== input.patientId) {
      throw new AppError("Patient package not found", ErrorCodes.NOT_FOUND);
    }
  }

  const { subtotal, gstAmount, totalAmount } = computeTotals(input.items, input.discountAmount);

  for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_ATTEMPTS; attempt++) {
    const invoiceNumber = await generateInvoiceNumber(supabase, caller.organization_id);
    let invoice: Invoice;
    try {
      invoice = await insertInvoice(supabase, {
        organization_id: caller.organization_id,
        invoice_number: invoiceNumber,
        patient_id: input.patientId,
        clinic_id: input.clinicId,
        appointment_id: input.appointmentId ?? null,
        patient_package_id: input.patientPackageId ?? null,
        invoice_date: input.invoiceDate,
        subtotal,
        gst_amount: gstAmount,
        discount_amount: input.discountAmount,
        total_amount: totalAmount,
        created_by: callerUserId,
      });
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === MAX_INVOICE_NUMBER_ATTEMPTS - 1) {
        throw error;
      }
      continue;
    }

    try {
      const items = await insertInvoiceItems(
        supabase,
        input.items.map((item) => ({
          organization_id: caller.organization_id!,
          invoice_id: invoice.id,
          item_name: item.itemName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          gst_percent: item.gstPercent,
          total: item.quantity * item.unitPrice * (1 + item.gstPercent / 100),
        }))
      );
      await recordAuditLog(supabase, {
        organizationId: invoice.organization_id,
        userId: callerUserId,
        action: "create",
        entityName: "invoices",
        entityId: invoice.id,
        newData: invoice,
      });
      return { invoice, items };
    } catch (error) {
      try {
        await removeInvoice(supabase, invoice.id);
      } catch {
        // TODO: Introduce centralized monitoring/alerting for compensation failures.
      }
      throw error;
    }
  }

  throw new Error("Failed to generate a unique invoice number");
}

/**
 * Updates an invoice's header and/or full item set. Blocked once a payment
 * exists -- invoices become immutable at that point (D6); corrections after
 * that happen through cancellation, not editing.
 */
export async function updateInvoice(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  invoiceId: string,
  input: UpdateInvoiceInput
): Promise<InvoiceWithItems> {
  const isAuthorized = await canManageInvoices(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const invoice = await findInvoiceById(supabase, invoiceId);
  if (!invoice) {
    throw new AppError("Invoice not found", ErrorCodes.NOT_FOUND);
  }

  if (invoice.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (await existsPaymentForInvoice(supabase, invoiceId)) {
    throw new AppError("Cannot edit an invoice that already has a payment", ErrorCodes.INVOICE_ALREADY_FINALIZED);
  }

  let updatedInvoice = invoice;
  const discountAmount = input.discountAmount ?? invoice.discount_amount;

  if (input.items) {
    const { subtotal, gstAmount, totalAmount } = computeTotals(input.items as CreateInvoiceInput["items"], discountAmount);

    await deleteInvoiceItemsByInvoice(supabase, invoiceId);
    await insertInvoiceItems(
      supabase,
      input.items.map((item) => ({
        organization_id: caller.organization_id!,
        invoice_id: invoiceId,
        item_name: item!.itemName,
        quantity: item!.quantity,
        unit_price: item!.unitPrice,
        gst_percent: item!.gstPercent ?? 0,
        total: item!.quantity * item!.unitPrice * (1 + (item!.gstPercent ?? 0) / 100),
      }))
    );

    updatedInvoice = await persistInvoiceUpdate(supabase, invoiceId, {
      subtotal,
      gst_amount: gstAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      invoice_date: input.invoiceDate,
    });
  } else if (input.discountAmount !== undefined || input.invoiceDate !== undefined) {
    const items = await listInvoiceItemsByInvoice(supabase, invoiceId);
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const gstAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price * (item.gst_percent / 100), 0);

    updatedInvoice = await persistInvoiceUpdate(supabase, invoiceId, {
      subtotal,
      gst_amount: gstAmount,
      discount_amount: discountAmount,
      total_amount: subtotal + gstAmount - discountAmount,
      invoice_date: input.invoiceDate,
    });
  }

  const items = await listInvoiceItemsByInvoice(supabase, invoiceId);
  return { invoice: updatedInvoice, items };
}

/**
 * Soft-deletes (cancels) an invoice. This is the correction mechanism for a
 * finalized invoice -- allowed regardless of payment state. It does not
 * reconcile an existing payment's status; that is scoped out this phase.
 */
export async function deleteInvoice(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  invoiceId: string
): Promise<Invoice> {
  const isAuthorized = await canDeleteInvoice(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const invoice = await findInvoiceById(supabase, invoiceId);
  if (!invoice) {
    throw new AppError("Invoice not found", ErrorCodes.NOT_FOUND);
  }

  if (invoice.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return persistInvoiceUpdate(supabase, invoiceId, { deleted_at: new Date().toISOString() });
}

/**
 * Fetches the details of an active invoice with its line items.
 */
export async function getInvoiceDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  invoiceId: string
): Promise<InvoiceWithItems> {
  const isAuthorized = await canAccessInvoice(supabase, callerUserId, invoiceId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const invoice = await findInvoiceById(supabase, invoiceId);
  if (!invoice) {
    throw new AppError("Invoice not found", ErrorCodes.NOT_FOUND);
  }

  const items = await listInvoiceItemsByInvoice(supabase, invoiceId);
  return { invoice, items };
}

/**
 * Lists organization invoices with pagination support.
 * - ORG_OWNER/ORG_ADMIN: org-wide.
 * - ORG_RECEPTIONIST: invoices at accessible clinics only.
 * - ORG_PHYSIOTHERAPIST: none through this listing (they access invoices
 *   individually through their own appointments via canAccessInvoice).
 */
export async function listOrganizationInvoices(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    clinicId?: string;
  }
): Promise<PagedResult<Invoice>> {
  const isAuthorized = await canViewInvoices(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const roleRecord = await findRoleById(supabase, caller.role_id);
  const roleName = roleRecord?.name;

  let effectiveFilters: typeof filters & { clinicIds?: string[] } = filters;
  if (roleName === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    if (filters.clinicId && !accessibleClinicIds.includes(filters.clinicId)) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
    }
    if (accessibleClinicIds.length === 0) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
    }
    effectiveFilters = filters.clinicId ? filters : { ...filters, clinicIds: accessibleClinicIds };
  } else if (roleName === "ORG_PHYSIOTHERAPIST") {
    return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
  }

  const items = await listInvoices(supabase, caller.organization_id, effectiveFilters);
  const total = await countInvoices(supabase, caller.organization_id, effectiveFilters);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
