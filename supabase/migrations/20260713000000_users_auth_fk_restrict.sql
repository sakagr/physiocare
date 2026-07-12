-- ============================================================
-- Migration: Protect audit history from Auth identity deletion
-- ============================================================
-- public.users.id previously referenced auth.users(id) ON DELETE CASCADE.
-- Off-boarding is defined as a soft delete (deleted_at), and off-boarded
-- users must remain in public.users for audit/history. A CASCADE FK
-- allows any deletion of the Auth identity (application code, dashboard,
-- or scripts) to silently destroy that audit trail. Deleting an Auth user
-- is a hard delete and, per the soft-delete strategy, hard deletes must
-- be exceptional administrative operations rather than an accidental
-- side effect of removing authentication access.
--
-- Switching to ON DELETE RESTRICT enforces this invariant at the
-- database level: the Auth identity cannot be removed while its
-- application profile still exists.

ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;
