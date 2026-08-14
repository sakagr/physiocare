import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Payment } from "../repositories/payment.repository";
import {
  insertPayment,
  updatePayment as persistPaymentUpdate,
  findPaymentById,
  existsPaymentForInvoice,
  listPaymentsByInvoice,
  listPaymentsByPatient,
} from "../repositories/payment.repository";
import { findUserById } from "../repositories/user.repository";
import { findInvoiceById } from "../repositories/invoice.repository";
import {
  canManagePayments,
  canUpdatePaymentStatus,
  canAccessPayment,
  canAccessInvoice,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { recordAuditLogSafe } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePaymentInput } from "../validators/payment.validator";

type PaymentStatus = Database["public"]["Enums"]["payment_transaction_status"];

/** completed -> refunded and completed -> cancelled are the only legal transitions. */
const LEGAL_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  completed: ["refunded", "cancelled"],
  refunded: [],
  cancelled: [],
};

/**
 * A status transition is a lifecycle event, so it audits under a domain verb
 * naming the target status rather than a generic "update".
 */
const STATUS_AUDIT_ACTIONS: Record<PaymentStatus, string> = {
  completed: "complete",
  refunded: "refund",
  cancelled: "cancel",
};

/**
 * Records a payment against an invoice. V1 supports exactly one payment per
 * invoice (no split/partial payments); patient_id/organization_id are copied
 * from the invoice, never taken from client input.
 */
export async function createPayment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  const isAuthorized = await canManagePayments(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const invoice = await findInvoiceById(supabase, input.invoiceId);
  if (!invoice || invoice.organization_id !== caller.organization_id) {
    throw new AppError("Invoice not found", ErrorCodes.NOT_FOUND);
  }

  if (await existsPaymentForInvoice(supabase, input.invoiceId)) {
    throw new AppError("A payment already exists for this invoice", ErrorCodes.PAYMENT_ALREADY_EXISTS_FOR_INVOICE);
  }

  if (input.amount > invoice.total_amount) {
    throw new AppError("Payment amount exceeds the invoice total", ErrorCodes.PAYMENT_EXCEEDS_INVOICE_TOTAL);
  }

  const payment = await insertPayment(supabase, {
    organization_id: invoice.organization_id,
    invoice_id: invoice.id,
    amount: input.amount,
    payment_mode: input.paymentMode,
    transaction_reference: input.transactionReference || null,
    paid_at: input.paidAt,
    received_by: callerUserId,
    payment_status: "completed",
  });

  await recordAuditLogSafe(supabase, {
    organizationId: invoice.organization_id,
    userId: callerUserId,
    action: "create",
    entityName: "payments",
    entityId: payment.id,
    newData: payment,
  });

  return payment;
}

/**
 * Transitions a payment's status. Only completed -> refunded and
 * completed -> cancelled are legal; any other transition is rejected so a
 * refund or cancellation can never be silently undone.
 */
export async function updatePaymentStatus(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  paymentId: string,
  status: PaymentStatus
): Promise<Payment> {
  const isAuthorized = await canUpdatePaymentStatus(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const payment = await findPaymentById(supabase, paymentId);
  if (!payment) {
    throw new AppError("Payment not found", ErrorCodes.NOT_FOUND);
  }

  if (payment.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (!LEGAL_STATUS_TRANSITIONS[payment.payment_status].includes(status)) {
    throw new AppError(
      `Cannot transition a payment from ${payment.payment_status} to ${status}`,
      ErrorCodes.INVALID_PAYMENT_STATUS_TRANSITION
    );
  }

  const previousStatus = payment.payment_status;
  const updated = await persistPaymentUpdate(supabase, paymentId, { payment_status: status });

  await recordAuditLogSafe(supabase, {
    organizationId: payment.organization_id,
    userId: callerUserId,
    action: STATUS_AUDIT_ACTIONS[status],
    entityName: "payments",
    entityId: payment.id,
    oldData: { payment_status: previousStatus },
    newData: { payment_status: status },
  });

  return updated;
}

/**
 * Fetches the details of an active payment.
 */
export async function getPaymentDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  paymentId: string
): Promise<Payment> {
  const isAuthorized = await canAccessPayment(supabase, callerUserId, paymentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const payment = await findPaymentById(supabase, paymentId);
  if (!payment) {
    throw new AppError("Payment not found", ErrorCodes.NOT_FOUND);
  }

  return payment;
}

/**
 * Lists the payment recorded against an invoice (V1: at most one).
 */
export async function listPaymentsForInvoice(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  invoiceId: string
): Promise<Payment[]> {
  const isAuthorized = await canAccessInvoice(supabase, callerUserId, invoiceId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  return listPaymentsByInvoice(supabase, invoiceId);
}

/**
 * Lists a patient's payments with pagination.
 */
export async function listPaymentsForPatient(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  filters: {
    page: number;
    limit: number;
  }
): Promise<PagedResult<Payment>> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const items = await listPaymentsByPatient(supabase, patientId, filters);

  return {
    items,
    total: items.length,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(items.length / filters.limit),
  };
}
