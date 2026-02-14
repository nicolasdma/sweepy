ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_scan_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_scan_frequency TEXT DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS last_auto_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS digest_email_enabled BOOLEAN DEFAULT true;

ALTER TABLE profiles
  ADD CONSTRAINT check_auto_scan_frequency CHECK (auto_scan_frequency IN ('daily', 'weekly'));
