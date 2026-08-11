-- Patient records gain a soft-delete column.
--
-- Records were append-only in V1. A scan attached to the wrong patient was the
-- one clinical write with no correction path: patient_records_delete_policy is
-- is_super_admin() only, so an Owner's hard delete would silently affect zero
-- rows. Soft delete runs as an UPDATE, which the Owner/Admin branch of
-- patient_records_update_policy already permits org-wide.
--
-- Deliberately kept separate from the front-desk access migration: the two have
-- independent intents and must be revertible independently.
--
-- No policy change. Liveness is enforced at the repository layer, not in RLS --
-- no policy in this schema filters its own table's deleted_at (see AGENTS.md ->
-- Soft Delete Strategy).

alter table public.patient_records add column deleted_at timestamptz null;
