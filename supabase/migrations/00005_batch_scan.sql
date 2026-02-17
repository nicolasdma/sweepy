-- Batch scan support: store Gmail message IDs and track processing progress
-- Allows client-driven batch processing to stay within Vercel Hobby 60s limit

ALTER TABLE email_scans
  ADD COLUMN IF NOT EXISTS gmail_message_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ids integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_phase text DEFAULT 'listing'
    CHECK (scan_phase IN ('listing', 'processing', 'completed', 'failed'));
