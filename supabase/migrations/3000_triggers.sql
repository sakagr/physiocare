-- ============================================================
-- updated_at Triggers
-- ============================================================

create trigger set_subscription_plans_updated_at
before update on public.subscription_plans
for each row execute function public.set_updated_at();

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_clinics_updated_at
before update on public.clinics
for each row execute function public.set_updated_at();

create trigger set_user_clinics_updated_at
before update on public.user_clinics
for each row execute function public.set_updated_at();

create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create trigger set_patient_records_updated_at
before update on public.patient_records
for each row execute function public.set_updated_at();

create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create trigger set_appointment_status_logs_updated_at
before update on public.appointment_status_logs
for each row execute function public.set_updated_at();

create trigger set_consultations_updated_at
before update on public.consultations
for each row execute function public.set_updated_at();

create trigger set_prescriptions_updated_at
before update on public.prescriptions
for each row execute function public.set_updated_at();

create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create trigger set_invoice_items_updated_at
before update on public.invoice_items
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_packages_updated_at
before update on public.packages
for each row execute function public.set_updated_at();

create trigger set_patient_packages_updated_at
before update on public.patient_packages
for each row execute function public.set_updated_at();

create trigger set_package_session_usage_updated_at
before update on public.package_session_usage
for each row execute function public.set_updated_at();

create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create trigger set_user_attendance_updated_at
before update on public.user_attendance
for each row execute function public.set_updated_at();
