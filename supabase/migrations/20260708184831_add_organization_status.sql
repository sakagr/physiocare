create type "public"."organization_status" as enum ('draft', 'active', 'inactive', 'archived');

alter table "public"."organizations" add column "status" public.organization_status not null default 'draft'::public.organization_status;


