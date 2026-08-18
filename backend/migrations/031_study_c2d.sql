-- 031_study_c2d.sql
-- Compute-to-Data (C2D) support for the data marketplace (owner follow-up:
-- "implement Ocean Protocol's Compute-to-Data feature").
--
-- When the marketplace is on-chain configured (funded wallet + RPC + Ocean
-- Node), publishing a dataset now deploys an ERC721 data NFT + ERC20 datatoken
-- (+ optional fixed-rate exchange) on the configured chain and registers the
-- DDO with a `compute` service, so buyers can run algorithms on the aggregate
-- instead of downloading it. These columns record the on-chain artifact
-- addresses and the compute policy that was stamped into the DDO.

ALTER TABLE marketplace_datasets
  ADD COLUMN IF NOT EXISTS nft_address TEXT,
  ADD COLUMN IF NOT EXISTS datatoken_address TEXT,
  ADD COLUMN IF NOT EXISTS exchange_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_url TEXT,
  ADD COLUMN IF NOT EXISTS c2d_policy JSONB,
  -- Key of the sanitized aggregate JSON in object storage (R2) that the Ocean
  -- Node fetches when a compute job runs. NULL when storage is not configured.
  ADD COLUMN IF NOT EXISTS aggregate_file_key TEXT,
  -- Last C2D attempt error — kept so admins can see why a dataset fell back
  -- to metadata-first publishing. Cleared on a successful C2D publish.
  ADD COLUMN IF NOT EXISTS c2d_error TEXT;

CREATE INDEX IF NOT EXISTS idx_marketplace_datasets_nft_address
  ON marketplace_datasets (nft_address);
