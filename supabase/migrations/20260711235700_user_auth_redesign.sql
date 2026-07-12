-- 1. Redefine the app_role enum type
ALTER TABLE public.roles ALTER COLUMN name TYPE text;

DROP TYPE public.app_role;

CREATE TYPE public.app_role AS ENUM (
  'SUPER_ADMIN',
  'PLATFORM_SUPPORT',
  'PLATFORM_SALES',
  'PLATFORM_BILLING',
  'ORG_OWNER',
  'ORG_ADMIN',
  'ORG_PHYSIOTHERAPIST',
  'ORG_RECEPTIONIST',
  'ORG_ACCOUNTANT'
);

-- Map old role names to the new ones
UPDATE public.roles SET name = 'ORG_RECEPTIONIST' WHERE name = 'RECEPTIONIST';
UPDATE public.roles SET name = 'ORG_PHYSIOTHERAPIST' WHERE name = 'PHYSIOTHERAPIST';
UPDATE public.roles SET name = 'ORG_OWNER' WHERE name = 'ORG_ADMIN';

ALTER TABLE public.roles ALTER COLUMN name TYPE public.app_role USING name::public.app_role;

-- 2. Enrich roles table metadata
ALTER TABLE public.roles ADD COLUMN display_name text;

-- Set metadata for existing roles
UPDATE public.roles SET display_name = 'Super Admin' WHERE name = 'SUPER_ADMIN';
UPDATE public.roles SET display_name = 'Owner' WHERE name = 'ORG_OWNER';
UPDATE public.roles SET display_name = 'Receptionist' WHERE name = 'ORG_RECEPTIONIST';
UPDATE public.roles SET display_name = 'Physiotherapist' WHERE name = 'ORG_PHYSIOTHERAPIST';

-- Make display_name required
ALTER TABLE public.roles ALTER COLUMN display_name SET NOT NULL;

-- Insert remaining new platform and organization roles
INSERT INTO public.roles (name, display_name) VALUES
  ('PLATFORM_SUPPORT', 'Platform Support'),
  ('PLATFORM_SALES', 'Platform Sales'),
  ('PLATFORM_BILLING', 'Platform Billing'),
  ('ORG_ADMIN', 'Administrator'),
  ('ORG_ACCOUNTANT', 'Accountant')
ON CONFLICT (name) DO NOTHING;

-- 3. Modify users table constraints and columns
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX users_active_email_key ON public.users (email) WHERE (deleted_at IS NULL);

-- Add username as nullable first
ALTER TABLE public.users ADD COLUMN username text;

-- Temporary usernames used only to satisfy the migration.
-- Local development data will be recreated after migration.
UPDATE public.users SET username = 'user_' || replace(id::text, '-', '') WHERE username IS NULL;

-- Set not null and add unique constraint
ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
