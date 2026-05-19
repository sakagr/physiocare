-- ============================================================
-- Table: currencies
-- ============================================================
-- Currencies supported by the application.

create table if not exists public.currencies (
    code varchar(3) primary key,
    name varchar(100) not null,
    symbol varchar(8) not null,
    locale varchar(20),
    decimal_places smallint not null default 2,
    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint currencies_code_check
        check (char_length(code) = 3)
);