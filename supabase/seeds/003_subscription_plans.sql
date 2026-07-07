insert into public.subscription_plans (
    plan_name,
    max_clinics,
    max_users,
    monthly_price,
    yearly_price,
    features
)
values (
    'Trial',
    1,
    5,
    0,
    0,
    '{}'::jsonb
)
on conflict (plan_name) do nothing;