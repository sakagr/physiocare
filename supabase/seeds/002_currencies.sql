insert into public.currencies (
    code,
    name,
    symbol,
    locale,
    decimal_places,
    is_active
)
values
    ('INR', 'Indian Rupee', '₹', 'en-IN', 2, true),
    ('USD', 'US Dollar', '$', 'en-US', 2, true)
on conflict (code) do nothing;