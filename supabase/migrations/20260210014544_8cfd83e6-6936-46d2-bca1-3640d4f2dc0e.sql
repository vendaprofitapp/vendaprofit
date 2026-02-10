-- Force connection pool refresh by creating a simple no-op function
-- This migration itself will trigger PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload config');