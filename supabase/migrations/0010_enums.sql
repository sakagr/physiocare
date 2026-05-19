-- ============================================================
-- Enums
-- ============================================================


create type public.app_role as enum (
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'RECEPTIONIST',
  'PHYSIOTHERAPIST'
);

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired'
);

create type public.commission_type as enum (
  'none',
  'percentage',
  'fixed'
);

create type public.patient_gender as enum (
  'female',
  'male',
  'other',
  'prefer_not_to_say'
);

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show'
);

create type public.appointment_type as enum (
  'initial_consultation',
  'follow_up',
  'therapy_session',
  'assessment'
);

create type public.payment_status as enum (
  'unpaid',
  'partially_paid',
  'paid',
  'refunded',
  'cancelled'
);

create type public.payment_mode as enum (
  'cash',
  'card',
  'upi',
  'bank_transfer',
  'cheque',
  'wallet',
  'other'
);

create type public.package_status as enum (
  'active',
  'completed',
  'expired',
  'cancelled'
);

create type public.notification_channel as enum (
  'sms',
  'email',
  'whatsapp',
  'in_app'
);

create type public.recipient_type as enum (
  'user',
  'patient'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed',
  'cancelled'
);

create type public.attendance_status as enum (
  'present',
  'absent',
  'half_day',
  'leave'
);
