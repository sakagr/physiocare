-- ============================================================
-- Migration: Support Soft-Deletion Re-usability for Clinics & User Clinics
-- ============================================================

-- Drop old unique constraints
ALTER TABLE public.clinics DROP CONSTRAINT IF EXISTS clinics_organization_id_clinic_name_key;
ALTER TABLE public.user_clinics DROP CONSTRAINT IF EXISTS user_clinics_user_id_clinic_id_key;

-- Recreate active-only unique indexes
CREATE UNIQUE INDEX clinics_organization_active_name_key ON public.clinics (organization_id, clinic_name) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX user_clinics_active_user_clinic_key ON public.user_clinics (user_id, clinic_id) WHERE (deleted_at IS NULL);
