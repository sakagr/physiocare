# physiocare
Modern physiotherapy clinic ERP for managing patients, consultations, packages, billing, and staff operations.

## Environment

Set these in `.env.local` for development, and their equivalents wherever the app is deployed:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key. Server-only — never exposed to the browser. |
| `DATABASE_URL` | Postgres connection string for migrations and tooling. |
| `NEXT_PUBLIC_SITE_URL` | The app's public origin (e.g. `http://127.0.0.1:3000`). Invitation and password-recovery emails link back to `${NEXT_PUBLIC_SITE_URL}/auth/callback`, so the value must also be allow-listed in the Supabase project's redirect URLs. |
