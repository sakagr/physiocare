insert into public.roles (name, display_name)
values
    ('SUPER_ADMIN', 'Super Admin'),
    ('PLATFORM_SUPPORT', 'Platform Support'),
    ('PLATFORM_SALES', 'Platform Sales'),
    ('PLATFORM_BILLING', 'Platform Billing'),
    ('ORG_OWNER', 'Owner'),
    ('ORG_ADMIN', 'Administrator'),
    ('ORG_PHYSIOTHERAPIST', 'Physiotherapist'),
    ('ORG_RECEPTIONIST', 'Receptionist')
on conflict (name) do update
set display_name = excluded.display_name;