-- ============================================================
-- Indexes
-- ============================================================

create index organizations_subscription_plan_id_idx on public.organizations(subscription_plan_id);
create index organizations_created_by_idx on public.organizations(created_by);

create index users_organization_id_idx on public.users(organization_id);
create index users_role_id_idx on public.users(role_id);

create index clinics_organization_id_idx on public.clinics(organization_id);

create index user_clinics_organization_id_idx on public.user_clinics(organization_id);
create index user_clinics_user_id_idx on public.user_clinics(user_id);
create index user_clinics_clinic_id_idx on public.user_clinics(clinic_id);

create index patients_organization_id_idx on public.patients(organization_id);
create index patients_created_by_idx on public.patients(created_by);

create index patient_records_organization_id_idx on public.patient_records(organization_id);
create index patient_records_patient_id_idx on public.patient_records(patient_id);
create index patient_records_uploaded_by_idx on public.patient_records(uploaded_by);

create index appointments_organization_id_idx on public.appointments(organization_id);
create index appointments_patient_id_idx on public.appointments(patient_id);
create index appointments_clinic_id_idx on public.appointments(clinic_id);
create index appointments_physiotherapist_id_idx on public.appointments(physiotherapist_id);
create index appointments_appointment_time_idx on public.appointments(appointment_time);
create index appointments_created_by_idx on public.appointments(created_by);
create index appointments_org_clinic_time_idx on public.appointments(organization_id, clinic_id, appointment_time);
create index appointments_org_physio_time_idx on public.appointments(organization_id, physiotherapist_id, appointment_time);

create index appointment_status_logs_organization_id_idx on public.appointment_status_logs(organization_id);
create index appointment_status_logs_appointment_id_idx on public.appointment_status_logs(appointment_id);
create index appointment_status_logs_changed_by_idx on public.appointment_status_logs(changed_by);

create index consultations_organization_id_idx on public.consultations(organization_id);
create index consultations_appointment_id_idx on public.consultations(appointment_id);
create index consultations_patient_id_idx on public.consultations(patient_id);
create index consultations_physiotherapist_id_idx on public.consultations(physiotherapist_id);

create index prescriptions_organization_id_idx on public.prescriptions(organization_id);
create index prescriptions_consultation_id_idx on public.prescriptions(consultation_id);
create index prescriptions_patient_id_idx on public.prescriptions(patient_id);
create index prescriptions_physiotherapist_id_idx on public.prescriptions(physiotherapist_id);

create index invoices_organization_id_idx on public.invoices(organization_id);
create index invoices_patient_id_idx on public.invoices(patient_id);
create index invoices_clinic_id_idx on public.invoices(clinic_id);
create index invoices_appointment_id_idx on public.invoices(appointment_id);
create index invoices_created_by_idx on public.invoices(created_by);

create index invoice_items_organization_id_idx on public.invoice_items(organization_id);
create index invoice_items_invoice_id_idx on public.invoice_items(invoice_id);

create index payments_organization_id_idx on public.payments(organization_id);
create index payments_invoice_id_idx on public.payments(invoice_id);
create index payments_received_by_idx on public.payments(received_by);

create index packages_organization_id_idx on public.packages(organization_id);
create index packages_clinic_id_idx on public.packages(clinic_id);

create index patient_packages_organization_id_idx on public.patient_packages(organization_id);
create index patient_packages_patient_id_idx on public.patient_packages(patient_id);
create index patient_packages_package_id_idx on public.patient_packages(package_id);

create index package_session_usage_organization_id_idx on public.package_session_usage(organization_id);
create index package_session_usage_patient_package_id_idx on public.package_session_usage(patient_package_id);

create index notifications_organization_id_idx on public.notifications(organization_id);
create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_patient_id_idx on public.notifications(patient_id);
create index notifications_appointment_id_idx on public.notifications(appointment_id);
create index notifications_status_idx on public.notifications(status);

create index audit_logs_organization_id_idx on public.audit_logs(organization_id);
create index audit_logs_user_id_idx on public.audit_logs(user_id);
create index audit_logs_entity_idx on public.audit_logs(entity_name, entity_id);

create index user_attendance_organization_id_idx on public.user_attendance(organization_id);
create index user_attendance_user_id_idx on public.user_attendance(user_id);
create index user_attendance_clinic_id_idx on public.user_attendance(clinic_id);
create index user_attendance_attendance_date_idx on public.user_attendance(attendance_date);
