-- Track real LLM token usage and costs per user per period
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS llm_input_tokens bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_output_tokens bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_cost_usd numeric(10, 6) DEFAULT 0;

-- Also track accumulated tokens per scan for batch processing
ALTER TABLE email_scans
  ADD COLUMN IF NOT EXISTS llm_input_tokens bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_output_tokens bigint DEFAULT 0;
