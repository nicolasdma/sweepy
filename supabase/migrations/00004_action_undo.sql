CREATE TABLE IF NOT EXISTS action_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES email_scans(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  total_actions INT NOT NULL,
  undone_at TIMESTAMPTZ
);

ALTER TABLE suggested_actions
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES action_batches(id),
  ADD COLUMN IF NOT EXISTS original_labels JSONB;
