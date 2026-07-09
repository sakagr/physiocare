alter table "public"."organizations" alter column "subscription_status" drop default;

alter type "public"."subscription_status" rename to "subscription_status__old_version_to_be_dropped";

create type "public"."subscription_status" as enum ('inactive', 'trialing', 'active', 'past_due', 'cancelled', 'expired');

alter table "public"."organizations" alter column subscription_status type "public"."subscription_status" using subscription_status::text::"public"."subscription_status";

alter table "public"."organizations" alter column "subscription_status" set default 'trialing'::public.subscription_status;

drop type "public"."subscription_status__old_version_to_be_dropped";

alter table "public"."organizations" alter column "subscription_status" set default 'inactive'::public.subscription_status;


