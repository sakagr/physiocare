drop trigger if exists "set_organization_users_updated_at" on "public"."organization_users";

drop policy "organization_users_delete_policy" on "public"."organization_users";

drop policy "organization_users_insert_policy" on "public"."organization_users";

drop policy "organization_users_select_policy" on "public"."organization_users";

drop policy "organization_users_update_policy" on "public"."organization_users";

revoke delete on table "public"."organization_users" from "anon";

revoke insert on table "public"."organization_users" from "anon";

revoke references on table "public"."organization_users" from "anon";

revoke select on table "public"."organization_users" from "anon";

revoke trigger on table "public"."organization_users" from "anon";

revoke truncate on table "public"."organization_users" from "anon";

revoke update on table "public"."organization_users" from "anon";

revoke delete on table "public"."organization_users" from "authenticated";

revoke insert on table "public"."organization_users" from "authenticated";

revoke references on table "public"."organization_users" from "authenticated";

revoke select on table "public"."organization_users" from "authenticated";

revoke trigger on table "public"."organization_users" from "authenticated";

revoke truncate on table "public"."organization_users" from "authenticated";

revoke update on table "public"."organization_users" from "authenticated";

revoke delete on table "public"."organization_users" from "service_role";

revoke insert on table "public"."organization_users" from "service_role";

revoke references on table "public"."organization_users" from "service_role";

revoke select on table "public"."organization_users" from "service_role";

revoke trigger on table "public"."organization_users" from "service_role";

revoke truncate on table "public"."organization_users" from "service_role";

revoke update on table "public"."organization_users" from "service_role";

alter table "public"."organization_users" drop constraint "organization_users_organization_id_fkey";

alter table "public"."organization_users" drop constraint "organization_users_organization_id_user_id_key";

alter table "public"."organization_users" drop constraint "organization_users_user_id_fkey";

alter table "public"."organization_users" drop constraint "organization_users_pkey";

drop index if exists "public"."organization_users_organization_id_idx";

drop index if exists "public"."organization_users_organization_id_user_id_key";

drop index if exists "public"."organization_users_pkey";

drop index if exists "public"."organization_users_user_id_idx";

drop table "public"."organization_users";


