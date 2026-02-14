-- Gmail OAuth token storage
-- Tokens stored in profiles for simplicity (MVP).
-- TODO: encrypt with AES-256 for production.

alter table public.profiles add column if not exists gmail_access_token text;
alter table public.profiles add column if not exists gmail_refresh_token text;
alter table public.profiles add column if not exists gmail_token_expires_at timestamptz;
alter table public.profiles add column if not exists gmail_connected boolean not null default false;
