-- 030_study_data_marketplace.sql
-- Owner brief: keep Study RPG sustainable by selling *educational data* through
-- the Ocean Protocol ecosystem, plus an admin-facing AI benchmarking pipeline
-- that measures how much studying with Study RPG actually improves outcomes.
--
-- PRIVACY-FIRST DESIGN (hard rules, enforced in code by `privacy-guard.ts`):
--   * Only AGGREGATES may ever be published — never raw rows, never free text,
--     never individual-level data.
--   * Only students who explicitly opted in (`data_consent`) are included in
--     published aggregates.
--   * A minimum group size (`minGroupSize`) and consent coverage threshold
--     must be met before anything can be published.
--   * Every publish/revoke action is audited with a reason (audit_logs).
--
-- Unique prefix 030, ordered after 029_study_wellbeing.sql.

-- 1) data_consent — explicit, revocable opt-in to anonymised aggregate sharing.
CREATE TABLE IF NOT EXISTS data_consent (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    consented    BOOLEAN NOT NULL DEFAULT FALSE,
    consented_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) marketplace_datasets — admin-defined, publishable aggregate datasets.
--    The DDO (decentralized identifier document) is stored here so a publish
--    can be re-submitted to Aquarius later or exported for manual upload.
CREATE TABLE IF NOT EXISTS marketplace_datasets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    dataset_type    VARCHAR(40) NOT NULL,          -- study_engagement | academic_outcomes | rpg_effectiveness
    cohort_filters  JSONB NOT NULL DEFAULT '{}',   -- allowlisted keys only: { country, board, grade }
    price_currency  VARCHAR(10) NOT NULL DEFAULT 'OCEAN',
    price_amount    NUMERIC(20,6) NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | published | revoked
    did             VARCHAR(255),                  -- did:op:... once minted/published
    ddo             JSONB,                         -- full Ocean DDO document
    privacy_report  JSONB,                         -- cohort size, consent coverage, guard verdict
    checksum        TEXT,                          -- sha256 of the aggregate payload
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_datasets_status ON marketplace_datasets(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_datasets_type ON marketplace_datasets(dataset_type);

-- 3) benchmark_runs — admin-initiated AI effectiveness assessments.
CREATE TABLE IF NOT EXISTS benchmark_runs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status       VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed
    config       JSONB NOT NULL DEFAULT '{}',
    metrics      JSONB,                                 -- computed metric deltas + effectiveness score
    report       JSONB,                                 -- AI narrative + breakdown (grounded in metrics only)
    summary      JSONB,                                 -- cohort + window summary
    error        TEXT,
    started_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status ON benchmark_runs(status);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created ON benchmark_runs(created_at DESC);
