insert into public.roles (name)
values
    ('SUPER_ADMIN'),
    ('ORG_ADMIN'),
    ('RECEPTIONIST'),
    ('PHYSIOTHERAPIST')
on conflict do nothing;