import { MarketplaceService } from './marketplace.service';
import { PRIVACY_DEFAULTS } from './privacy-guard';
import { NotImplementedException } from '@nestjs/common';

function draftDataset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    name: 'Focus engagement aggregates',
    description: '',
    dataset_type: 'study_engagement',
    cohort_filters: {},
    price_currency: 'OCEAN',
    price_amount: 10,
    status: 'draft',
    did: null,
    privacy_report: null,
    checksum: null,
    created_at: new Date(),
    published_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function makeDb(
  overrides: { dataset?: Record<string, unknown>; consenting?: number; total?: number } = {},
) {
  const store: {
    consent: Array<Record<string, unknown>>;
    audits: Array<Record<string, unknown>>;
    datasets: Array<Record<string, unknown>>;
  } = { consent: [], audits: [], datasets: [] };
  if (overrides.dataset) store.datasets.push({ ...overrides.dataset });
  const findRow = (params: unknown[]) =>
    store.datasets.find((d) => d.id === params[params.length - 1]);
  return {
    store,
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('INSERT INTO data_consent')) {
        store.consent.push({
          user_id: params[0],
          consented: params[1],
          consented_at: params[2],
          withdrawn_at: params[3],
        });
      } else if (sql.startsWith('INSERT INTO audit_logs')) {
        store.audits.push({
          actor_id: params[0],
          action: params[1],
          target_type: params[2],
          target_id: params[3],
          reason: params[4],
          details: params[5],
        });
      } else if (sql.startsWith('INSERT INTO marketplace_datasets')) {
        store.datasets.push({
          id: params[0],
          name: params[1],
          description: params[2],
          dataset_type: params[3],
          cohort_filters: params[4],
          price_currency: params[5],
          price_amount: params[6],
          status: 'draft',
          created_by: params[7],
          created_at: new Date(),
          published_at: null,
          revoked_at: null,
          did: null,
          privacy_report: null,
          checksum: null,
        });
      } else if (
        sql.startsWith('UPDATE marketplace_datasets') &&
        sql.includes("status = 'published'")
      ) {
        // Success-path update: $1 did, $2 ddo, $3 report, $4 checksum,
        // $5 nft, $6 dt, $7 exchange, $8 provider, $9 policy, $10 file key, $11 id
        const row = findRow(params);
        if (row) {
          Object.assign(row, {
            status: 'published',
            did: params[0],
            ddo: params[1],
            privacy_report: params[2],
            checksum: params[3],
            nft_address: params[4],
            datatoken_address: params[5],
            exchange_id: params[6],
            provider_url: params[7],
            c2d_policy: params[8],
            aggregate_file_key: params[9],
            c2d_error: null,
            published_at: new Date(),
          });
        }
      } else if (
        sql.startsWith('UPDATE marketplace_datasets') &&
        sql.includes("status = 'revoked'")
      ) {
        const row = findRow(params);
        if (row) {
          row.status = 'revoked';
          row.revoked_at = new Date();
        }
      } else if (sql.startsWith('UPDATE marketplace_datasets')) {
        // Blocked/draft updates keep the row as-is (status untouched).
        void findRow(params);
      }
      return {};
    }),
    queryOne: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM data_consent WHERE user_id = $1')) {
        return store.consent.find((c) => c.user_id === params[0]) ?? null;
      }
      if (sql.includes('FROM marketplace_datasets WHERE id = $1')) {
        return store.datasets.find((d) => d.id === params[0]) ?? null;
      }
      if (sql.includes('FROM users u') && sql.includes('JOIN data_consent dc')) {
        return { count: overrides.consenting ?? 0 };
      }
      if (sql.includes('FROM users u') && !sql.includes('JOIN data_consent dc')) {
        return { count: overrides.total ?? 0 };
      }
      if (sql.includes('FROM focus_sessions fs')) {
        return {
          count_active_users: overrides.consenting ?? 0,
          total_focus_minutes: 4200,
          avg_focus_minutes_per_session: 25,
          count_completed_sessions: 168,
          avg_focus_minutes_per_user: 84,
          count_user_session_days: 500,
        };
      }
      if (sql.includes('FROM player_profiles pp')) {
        return {
          count_active_players: overrides.consenting ?? 0,
          avg_player_xp: 1200,
          avg_player_level: 8,
          avg_study_streak: 4,
          total_stp_earned: 2500,
          avg_stp_per_player: 50,
        };
      }
      return null;
    }),
    queryMany: jest.fn(async () => []),
  };
}

/** Marketplace config — `enabled` defaults to true so publish paths run. */
function makeOcean(enabled = true) {
  return {
    getConfig: jest.fn(() => ({
      enabled,
      aquariusUrl: 'https://aquarius.example.com',
      publisherAddress: null,
      publisherPrivateKey: null,
      chainId: 137,
      publishEnabled: true,
      c2dOnly: true,
      minGroupSize: PRIVACY_DEFAULTS.minGroupSize,
      consentThreshold: PRIVACY_DEFAULTS.consentThreshold,
      license: 'CC-BY-4.0 (aggregate statistics only)',
    })),
    getStatus: jest.fn(() => ({ publishMode: enabled ? 'c2d-unconfigured' : 'disabled' })),
    buildDdo: jest.fn(),
    publishMetadata: jest.fn(async () => ({ published: false, did: 'x', reason: 'unused' })),
  };
}

/** C2D mock — by default unconfigured so publish is blocked (no fallback). */
function makeC2D(overrides: Record<string, unknown> = {}) {
  const configured = overrides.configured === true;
  const getConfig = jest.fn(() => ({
    publisherPrivateKey: configured ? '0xwallet' : null,
    rpcUrl: configured ? 'https://rpc.example.com' : null,
    nodeUrl: configured ? 'https://node.example.com/' : null,
    c2d: {
      allowRawAlgorithm: true,
      allowNetworkAccess: false,
      trustedAlgorithmPublishers: [],
    },
    ...(overrides.config ?? {}),
  }));
  const publishComputeAsset = jest.fn(
    async (input: unknown) =>
      overrides.c2dResult ?? {
        ok: true,
        did: 'did:op:137:c2dasset',
        nftAddress: '0xNft',
        datatokenAddress: '0xDt',
        exchangeId: '0xExchange',
        providerUrl: 'https://node.example.com/',
        chainId: 137,
        ddo: {
          id: 'did:op:137:c2dasset',
          services: [
            {
              id: 'service-1',
              type: 'compute',
              files: 'encrypted',
              datatokenAddress: '0xDt',
              serviceEndpoint: 'https://node.example.com/',
              timeout: 3600,
              compute: {
                allowRawAlgorithm: (input as { policy: { allowRawAlgorithm: boolean } }).policy
                  .allowRawAlgorithm,
                allowNetworkAccess: false,
                publisherTrustedAlgorithmPublishers: [],
                publisherTrustedAlgorithms: [],
              },
            },
          ],
        },
        transactions: { create: '0xCreateTx', setMetadata: '0xMetaTx' },
      },
  );
  return {
    getConfig,
    publishComputeAsset,
    getStatus: jest.fn(() => ({ onChainReady: configured })),
  };
}

function makeStorage() {
  return {
    upload: jest.fn(async () => ({
      key: 'marketplace/agg.json',
      url: 'https://cdn.example.com/marketplace/agg.json',
    })),
  };
}

const runnerOk = {
  run: jest.fn(async () => ({
    status: 'success' as const,
    stdout: '{"mean": 42}\n',
    stderr: '',
    exitCode: 0,
    executionTimeMs: 12,
  })),
};

function makeService(
  db: unknown,
  ocean: unknown,
  c2d = makeC2D(),
  storage = makeStorage(),
  runner = runnerOk,
) {
  return new MarketplaceService(
    db as never,
    ocean as never,
    c2d as never,
    storage as never,
    runner as never,
  );
}

const baseInput = {
  name: 'Focus engagement aggregates',
  datasetType: 'study_engagement' as const,
  reason: 'Admin dataset for market research',
  cohortFilters: { country: 'India' },
};

describe('MarketplaceService', () => {
  it('records consent opt-in and an audit row', async () => {
    const db = makeDb();
    const svc = makeService(db, makeOcean());
    const view = await svc.setConsent('u1', true);
    expect(view.consented).toBe(true);
    expect(db.store.audits.find((a) => a.action === 'data_consent.change')).toBeTruthy();
    expect(db.store.audits[0].details).toContain('"consented":true');
  });

  it('rejects unknown dataset types', async () => {
    const db = makeDb();
    const svc = makeService(db, makeOcean());
    await expect(
      svc.createDataset('admin1', { ...baseInput, datasetType: 'raw_rows' as never }),
    ).rejects.toThrow(/datasetType must be one of/);
  });

  it('creates a draft dataset with audit trail', async () => {
    const db = makeDb();
    const svc = makeService(db, makeOcean());
    const view = await svc.createDataset('admin1', baseInput);
    expect(view.status).toBe('draft');
    expect(view.cohortFilters.country).toBe('India');
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.dataset_create')).toBe(true);
  });

  it('refuses everything while the marketplace master switch is off', async () => {
    const db = makeDb({ dataset: draftDataset(), consenting: 50, total: 60 });
    const svc = makeService(db, makeOcean(false));
    await expect(svc.publishDataset('admin1', 'd1', 'publish it')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('blocks publication when the cohort is too small (privacy guard)', async () => {
    const db = makeDb({ dataset: draftDataset(), consenting: 5, total: 60 });
    const svc = makeService(db, makeOcean());
    await expect(svc.publishDataset('admin1', 'd1', 'publish it')).rejects.toThrow(
      /Privacy guard blocked/,
    );
  });

  it('keeps the dataset a draft when C2D is unconfigured — NO metadata-only fallback', async () => {
    const ocean = makeOcean();
    const db = makeDb({
      dataset: draftDataset(),
      consenting: 50,
      total: 60,
    });
    const svc = makeService(db, ocean);
    const view = await svc.publishDataset('admin1', 'd1', 'publish it');
    expect(view.status).toBe('draft');
    expect(view.did).toBeNull();
    expect(ocean.buildDdo).not.toHaveBeenCalled();
    expect(ocean.publishMetadata).not.toHaveBeenCalled();
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.publish_blocked')).toBe(true);
  });

  it('keeps the dataset a draft and records c2d_error when the C2D publish fails', async () => {
    const ocean = makeOcean();
    const c2d = makeC2D({
      configured: true,
      c2dResult: { ok: false, reason: 'Insufficient MATIC for gas' },
    });
    const db = makeDb({ dataset: draftDataset(), consenting: 50, total: 60 });
    const svc = makeService(db, ocean, c2d);
    const view = await svc.publishDataset('admin1', 'd1', 'publish it');
    expect(view.status).toBe('draft');
    expect(view.did).toBeNull();
    expect(ocean.publishMetadata).not.toHaveBeenCalled();
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.publish_blocked')).toBe(true);
  });

  it('publishes ONLY after the full on-chain C2D asset exists', async () => {
    const ocean = makeOcean();
    const c2d = makeC2D({ configured: true });
    const storage = makeStorage();
    const db = makeDb({ dataset: draftDataset(), consenting: 50, total: 60 });
    const svc = makeService(db, ocean, c2d, storage);
    const view = await svc.publishDataset('admin1', 'd1', 'publish it');
    expect(view.status).toBe('published');
    expect(view.did).toBe('did:op:137:c2dasset');
    expect(view.nftAddress).toBe('0xNft');
    expect(view.datatokenAddress).toBe('0xDt');
    expect(view.exchangeId).toBe('0xExchange');
    expect(view.providerUrl).toBe('https://node.example.com/');
    // The aggregate is uploaded to storage and handed to the C2D publisher.
    expect(storage.upload).toHaveBeenCalled();
    expect(c2d.publishComputeAsset).toHaveBeenCalled();
    const c2dInput = c2d.publishComputeAsset.mock.calls[0][0] as {
      fileUrl: string;
      checksum: string;
      policy: { allowRawAlgorithm: boolean; allowNetworkAccess: boolean };
    };
    expect(c2dInput.fileUrl).toBe('https://cdn.example.com/marketplace/agg.json');
    expect(c2dInput.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(c2dInput.policy.allowRawAlgorithm).toBe(true);
    // HARD INVARIANT: compute jobs never get network access.
    expect(c2dInput.policy.allowNetworkAccess).toBe(false);
    // No metadata-only DDO is ever built or pushed.
    expect(ocean.buildDdo).not.toHaveBeenCalled();
    expect(ocean.publishMetadata).not.toHaveBeenCalled();
  });

  it('rejects any request that asks for network access outright', async () => {
    const db = makeDb({ dataset: draftDataset(), consenting: 50, total: 60 });
    const svc = makeService(db, makeOcean(), makeC2D({ configured: true }));
    await expect(
      svc.publishDataset('admin1', 'd1', 'publish it', {
        allowRawAlgorithm: false,
        allowNetworkAccess: true,
        trustedAlgorithmPublishers: ['0xAlgoPub'],
      }),
    ).rejects.toThrow(/compute jobs can never be granted network access/);
  });

  it('forces network access off even when base config was tampered with', async () => {
    const db = makeDb({ dataset: draftDataset(), consenting: 50, total: 60 });
    const c2d = makeC2D({ configured: true });
    // Simulate an env misconfiguration attempt.
    c2d.getConfig.mockReturnValue({
      publisherPrivateKey: '0xwallet',
      rpcUrl: 'https://rpc.example.com',
      nodeUrl: 'https://node.example.com/',
      c2d: { allowRawAlgorithm: true, allowNetworkAccess: true, trustedAlgorithmPublishers: [] },
    });
    const svc = makeService(db, makeOcean(), c2d);
    await svc.publishDataset('admin1', 'd1', 'publish it');
    const c2dInput = c2d.publishComputeAsset.mock.calls[0][0] as {
      policy: { allowNetworkAccess: boolean };
    };
    expect(c2dInput.policy.allowNetworkAccess).toBe(false);
  });

  it('runs researcher algorithms against the stored sanitized aggregate', async () => {
    const runner = {
      run: jest.fn(async () => ({
        status: 'success' as const,
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 5,
      })),
    };
    const db = makeDb({
      dataset: draftDataset({
        privacy_report: JSON.stringify({ payload: { count_active_users: 50 } }),
      }),
      consenting: 50,
      total: 60,
    });
    const svc = makeService(db, makeOcean(), makeC2D(), makeStorage(), runner);
    const result = await svc.testCompute('admin1', 'd1', 'print(1)', { language: 'python' });
    expect(result.status).toBe('success');
    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'python',
        data: JSON.stringify({ count_active_users: 50 }),
      }),
    );
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.c2d_test_run')).toBe(true);
  });

  it('refuses test runs before a sanitized payload exists', async () => {
    const db = makeDb({ dataset: draftDataset(), consenting: 50, total: 60 });
    const svc = makeService(db, makeOcean());
    await expect(svc.testCompute('admin1', 'd1', 'print(1)')).rejects.toThrow(
      /No privacy-guarded aggregate exists/,
    );
  });

  it('revokes a dataset and audits the action', async () => {
    const db = makeDb({
      dataset: draftDataset({ status: 'published', did: 'did:op:1:x', checksum: 'abc' }),
    });
    const svc = makeService(db, makeOcean());
    const view = await svc.revokeDataset('admin1', 'd1', 'no longer valid');
    expect(view.status).toBe('revoked');
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.revoke')).toBe(true);
  });
});
