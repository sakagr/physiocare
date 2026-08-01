insert into public.roles (name, display_name)
values
    ('SUPER_ADMIN', 'Super Admin'),
    ('ORG_OWNER', 'Owner'),
    ('ORG_ADMIN', 'Administrator'),
    ('ORG_PHYSIOTHERAPIST', 'Physiotherapist'),
    ('ORG_RECEPTIONIST', 'Receptionist')
on conflict (name) do update
set display_name = excluded.display_name;