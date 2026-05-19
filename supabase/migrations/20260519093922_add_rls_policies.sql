alter table "public"."appointment_status_logs" enable row level security;

alter table "public"."appointments" enable row level security;

alter table "public"."audit_logs" enable row level security;

alter table "public"."clinics" enable row level security;

alter table "public"."consultations" enable row level security;

alter table "public"."currencies" enable row level security;

alter table "public"."invoice_items" enable row level security;

alter table "public"."invoices" enable row level security;

alter table "public"."notifications" enable row level security;

alter table "public"."organization_users" enable row level security;

alter table "public"."organizations" enable row level security;

alter table "public"."package_session_usage" enable row level security;

alter table "public"."packages" enable row level security;

alter table "public"."patient_packages" enable row level security;

alter table "public"."patient_records" enable row level security;

alter table "public"."patients" enable row level security;

alter table "public"."payments" enable row level security;

alter table "public"."prescriptions" enable row level security;

alter table "public"."roles" enable row level security;

alter table "public"."subscription_plans" enable row level security;

alter table "public"."user_attendance" enable row level security;

alter table "public"."user_clinics" enable row level security;

alter table "public"."users" enable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_organization_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    select organization_id
    from public.users
    where id = auth.uid()
    limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    select r.name
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
    limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    select exists (
        select 1
        from public.users u
        join public.roles r on r.id = u.role_id
        where u.id = auth.uid()
          and r.name = 'SUPER_ADMIN'
    );
$function$
;


  create policy "appointment_status_logs_delete_policy"
  on "public"."appointment_status_logs"
  as permissive
  for delete
  to authenticated
using (false);



  create policy "appointment_status_logs_insert_policy"
  on "public"."appointment_status_logs"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "appointment_status_logs_select_policy"
  on "public"."appointment_status_logs"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = appointment_status_logs.appointment_id) AND (((a.organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR ((a.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)) OR (a.physiotherapist_id = auth.uid())))))));



  create policy "appointment_status_logs_update_policy"
  on "public"."appointment_status_logs"
  as permissive
  for update
  to authenticated
using (false)
with check (false);



  create policy "appointments_delete_policy"
  on "public"."appointments"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "appointments_insert_policy"
  on "public"."appointments"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "appointments_select_policy"
  on "public"."appointments"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR ((clinic_id IN ( SELECT uc.clinic_id
   FROM public.user_clinics uc
  WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)) OR (physiotherapist_id = auth.uid())));



  create policy "appointments_update_policy"
  on "public"."appointments"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR ((clinic_id IN ( SELECT uc.clinic_id
   FROM public.user_clinics uc
  WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)) OR (physiotherapist_id = auth.uid())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "audit_logs_delete_policy"
  on "public"."audit_logs"
  as permissive
  for delete
  to authenticated
using (false);



  create policy "audit_logs_insert_policy"
  on "public"."audit_logs"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "audit_logs_select_policy"
  on "public"."audit_logs"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))));



  create policy "audit_logs_update_policy"
  on "public"."audit_logs"
  as permissive
  for update
  to authenticated
using (false)
with check (false);



  create policy "clinics_delete_policy"
  on "public"."clinics"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "clinics_insert_policy"
  on "public"."clinics"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "clinics_select_policy"
  on "public"."clinics"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "clinics_update_policy"
  on "public"."clinics"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "consultations_delete_policy"
  on "public"."consultations"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "consultations_insert_policy"
  on "public"."consultations"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "consultations_select_policy"
  on "public"."consultations"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = consultations.appointment_id) AND (a.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)))) OR (physiotherapist_id = auth.uid())));



  create policy "consultations_update_policy"
  on "public"."consultations"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (physiotherapist_id = auth.uid())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "currencies_delete_policy"
  on "public"."currencies"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "currencies_insert_policy"
  on "public"."currencies"
  as permissive
  for insert
  to authenticated
with check (public.is_super_admin());



  create policy "currencies_select_policy"
  on "public"."currencies"
  as permissive
  for select
  to authenticated
using (true);



  create policy "currencies_update_policy"
  on "public"."currencies"
  as permissive
  for update
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());



  create policy "invoice_items_delete_policy"
  on "public"."invoice_items"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "invoice_items_insert_policy"
  on "public"."invoice_items"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "invoice_items_select_policy"
  on "public"."invoice_items"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.invoices i
  WHERE ((i.id = invoice_items.invoice_id) AND (((i.organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR ((i.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)) OR (EXISTS ( SELECT 1
           FROM public.appointments a
          WHERE ((a.id = i.appointment_id) AND (a.physiotherapist_id = auth.uid()))))))))));



  create policy "invoice_items_update_policy"
  on "public"."invoice_items"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text])))))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "invoices_delete_policy"
  on "public"."invoices"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "invoices_insert_policy"
  on "public"."invoices"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "invoices_select_policy"
  on "public"."invoices"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR ((clinic_id IN ( SELECT uc.clinic_id
   FROM public.user_clinics uc
  WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = invoices.appointment_id) AND (a.physiotherapist_id = auth.uid()))))));



  create policy "invoices_update_policy"
  on "public"."invoices"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text])))))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "notifications_delete_policy"
  on "public"."notifications"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "notifications_insert_policy"
  on "public"."notifications"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "notifications_select_policy"
  on "public"."notifications"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (user_id = auth.uid()) OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))));



  create policy "notifications_update_policy"
  on "public"."notifications"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "organization_users_delete_policy"
  on "public"."organization_users"
  as permissive
  for delete
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))));



  create policy "organization_users_insert_policy"
  on "public"."organization_users"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))));



  create policy "organization_users_select_policy"
  on "public"."organization_users"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "organization_users_update_policy"
  on "public"."organization_users"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))))
with check ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))));



  create policy "organizations_delete_policy"
  on "public"."organizations"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "organizations_insert_policy"
  on "public"."organizations"
  as permissive
  for insert
  to authenticated
with check (public.is_super_admin());



  create policy "organizations_select_policy"
  on "public"."organizations"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (id = public.current_organization_id())));



  create policy "organizations_update_policy"
  on "public"."organizations"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (id = public.current_organization_id())))
with check ((public.is_super_admin() OR (id = public.current_organization_id())));



  create policy "package_session_usage_delete_policy"
  on "public"."package_session_usage"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "package_session_usage_insert_policy"
  on "public"."package_session_usage"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "package_session_usage_select_policy"
  on "public"."package_session_usage"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = package_session_usage.appointment_id) AND (a.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)))) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = package_session_usage.appointment_id) AND (a.physiotherapist_id = auth.uid()))))));



  create policy "package_session_usage_update_policy"
  on "public"."package_session_usage"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "packages_delete_policy"
  on "public"."packages"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "packages_insert_policy"
  on "public"."packages"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "packages_select_policy"
  on "public"."packages"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "packages_update_policy"
  on "public"."packages"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))))
with check ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))));



  create policy "patient_packages_delete_policy"
  on "public"."patient_packages"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "patient_packages_insert_policy"
  on "public"."patient_packages"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "patient_packages_select_policy"
  on "public"."patient_packages"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.patient_id = patient_packages.patient_id) AND (a.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)))) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.patient_id = patient_packages.patient_id) AND (a.physiotherapist_id = auth.uid()))))));



  create policy "patient_packages_update_policy"
  on "public"."patient_packages"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "patient_records_delete_policy"
  on "public"."patient_records"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "patient_records_insert_policy"
  on "public"."patient_records"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "patient_records_select_policy"
  on "public"."patient_records"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text]))) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.patient_id = patient_records.patient_id) AND (a.physiotherapist_id = auth.uid()))))));



  create policy "patient_records_update_policy"
  on "public"."patient_records"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text]))) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.patient_id = patient_records.patient_id) AND (a.physiotherapist_id = auth.uid()))))))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "patients_delete_policy"
  on "public"."patients"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "patients_insert_policy"
  on "public"."patients"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "patients_select_policy"
  on "public"."patients"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text]))) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.patient_id = patients.id) AND (a.physiotherapist_id = auth.uid()))))));



  create policy "patients_update_policy"
  on "public"."patients"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text]))) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.patient_id = patients.id) AND (a.physiotherapist_id = auth.uid()))))))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "payments_delete_policy"
  on "public"."payments"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "payments_insert_policy"
  on "public"."payments"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "payments_select_policy"
  on "public"."payments"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (EXISTS ( SELECT 1
   FROM public.invoices i
  WHERE ((i.id = payments.invoice_id) AND (i.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)))) OR (EXISTS ( SELECT 1
   FROM (public.invoices i
     JOIN public.appointments a ON ((a.id = i.appointment_id)))
  WHERE ((i.id = payments.invoice_id) AND (a.physiotherapist_id = auth.uid()))))));



  create policy "payments_update_policy"
  on "public"."payments"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = ANY (ARRAY['ORG_ADMIN'::text, 'RECEPTIONIST'::text])))))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "prescriptions_delete_policy"
  on "public"."prescriptions"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "prescriptions_insert_policy"
  on "public"."prescriptions"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "prescriptions_select_policy"
  on "public"."prescriptions"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (EXISTS ( SELECT 1
   FROM (public.consultations c
     JOIN public.appointments a ON ((a.id = c.appointment_id)))
  WHERE ((c.id = prescriptions.consultation_id) AND (a.clinic_id IN ( SELECT uc.clinic_id
           FROM public.user_clinics uc
          WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text)))) OR (physiotherapist_id = auth.uid())));



  create policy "prescriptions_update_policy"
  on "public"."prescriptions"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (physiotherapist_id = auth.uid())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "roles_delete_policy"
  on "public"."roles"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "roles_insert_policy"
  on "public"."roles"
  as permissive
  for insert
  to authenticated
with check (public.is_super_admin());



  create policy "roles_select_policy"
  on "public"."roles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "roles_update_policy"
  on "public"."roles"
  as permissive
  for update
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());



  create policy "subscription_plans_delete_policy"
  on "public"."subscription_plans"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "subscription_plans_insert_policy"
  on "public"."subscription_plans"
  as permissive
  for insert
  to authenticated
with check (public.is_super_admin());



  create policy "subscription_plans_select_policy"
  on "public"."subscription_plans"
  as permissive
  for select
  to authenticated
using (true);



  create policy "subscription_plans_update_policy"
  on "public"."subscription_plans"
  as permissive
  for update
  to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());



  create policy "user_attendance_delete_policy"
  on "public"."user_attendance"
  as permissive
  for delete
  to authenticated
using (public.is_super_admin());



  create policy "user_attendance_insert_policy"
  on "public"."user_attendance"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "user_attendance_select_policy"
  on "public"."user_attendance"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR ((organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text)) OR (user_id = auth.uid()) OR ((clinic_id IN ( SELECT uc.clinic_id
   FROM public.user_clinics uc
  WHERE (uc.user_id = auth.uid()))) AND (public.current_user_role() = 'RECEPTIONIST'::text))));



  create policy "user_attendance_update_policy"
  on "public"."user_attendance"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "user_clinics_delete_policy"
  on "public"."user_clinics"
  as permissive
  for delete
  to authenticated
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = user_clinics.user_id) AND (u.organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))))));



  create policy "user_clinics_insert_policy"
  on "public"."user_clinics"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = user_clinics.user_id) AND (u.organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))))));



  create policy "user_clinics_select_policy"
  on "public"."user_clinics"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = user_clinics.user_id) AND (u.organization_id = public.current_organization_id()))))));



  create policy "user_clinics_update_policy"
  on "public"."user_clinics"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = user_clinics.user_id) AND (u.organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))))))
with check ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = user_clinics.user_id) AND (u.organization_id = public.current_organization_id()) AND (public.current_user_role() = 'ORG_ADMIN'::text))))));



  create policy "users_delete_policy"
  on "public"."users"
  as permissive
  for select
  to authenticated
using (public.is_super_admin());



  create policy "users_insert_policy"
  on "public"."users"
  as permissive
  for insert
  to authenticated
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "users_select_policy"
  on "public"."users"
  as permissive
  for select
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



  create policy "users_update_policy"
  on "public"."users"
  as permissive
  for update
  to authenticated
using ((public.is_super_admin() OR (organization_id = public.current_organization_id())))
with check ((public.is_super_admin() OR (organization_id = public.current_organization_id())));



