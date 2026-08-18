import { MarketplaceService } from './marketplace.service';
import { PRIVACY_DEFAULTS } from './privacy-guard';

function makeDb(
  overrides: { dataset?: Record<string, unknown>; consenting?: number; total?: number } = {},
) {
  const store: {
    consent: Array<Record<string, unknown>>;
    audits: Array<Record<string, unknown>>;
    datasets: Array<Record<string, unknown>>;
  } = {
    consent: [],
    audits: [],
    datasets: [],
  };
  if (overrides.dataset) store.datasets.push({ ...overrides.dataset });
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
      } else if (sql.startsWith('UPDATE marketplace_datasets')) {
        const row = store.datasets.find((d) => d.id === params[params.length - 1]);
        if (row) {
          if (sql.includes("status = 'published'")) {
            row.status = 'published';
            row.did = params[0];
            row.ddo = params[1];
            row.privacy_report = params[2];
            row.checksum = params[3];
            row.nft_address = params[4];
            row.datatoken_address = params[5];
            row.exchange_id = params[6];
            row.provider_url = params[7];
            row.c2d_policy = params[8];
            row.c2d_error = params[10];
            row.published_at = new Date();
          } else if (sql.includes("status = 'revoked'")) {
            row.status = 'revoked';
            row.revoked_at = new Date();
          }
        }
      }
      return {};
    }),
    queryOne: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM data_consent WHERE user_id = $1')) {
        return store.consent.find((c) => c.user_id === params[0]) ?? null;
      }
      if (sql.includes('FROM marketplace_datasets WHERE id = $1')) {
        return store.datasets.find((d) => d.id === params[0]) ?? overrides.dataset ?? null;
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

function makeOcean() {
  return {
    getConfig: jest.fn(() => ({
      aquariusUrl: 'https://aquarius.example.com',
      publisherAddress: null,
      publisherPrivateKey: null,
      chainId: 1,
      publishEnabled: true,
      minGroupSize: PRIVACY_DEFAULTS.minGroupSize,
      consentThreshold: PRIVACY_DEFAULTS.consentThreshold,
      license: 'CC-BY-4.0 (aggregate statistics only)',
    })),
    buildDdo: jest.fn((input: unknown) => ({
      id: 'did:op:1:deadbeef',
      metadata: { type: 'dataset', name: (input as { name: string }).name },
    })),
    publishMetadata: jest.fn(async () => ({ published: true, did: 'did:op:1:deadbeef' })),
  };
}

/** C2D mock — by default unconfigured so publish falls back to metadata-first. */
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
    upload: jest.fn(async (_buffer: Buffer, _filename: string, _opts?: unknown) => ({
      key: 'marketplace/agg.json',
      url: 'https://cdn.example.com/marketplace/agg.json',
    })),
  };
}

function makeService(db: unknown, ocean: unknown, c2d = makeC2D(), storage = makeStorage()) {
  return new MarketplaceService(db as never, ocean as never, c2d as never, storage as never);
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
    expect(db.store.consent.length).toBe(1);
    const audit = db.store.audits.find((a) => a.action === 'data_consent.change');
    expect(audit).toBeTruthy();
    expect(audit!.details).toContain('"consented":true');
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
    expect(db.store.datasets.length).toBe(1);
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.dataset_create')).toBe(true);
  });

  it('blocks publication when the cohort is too small (privacy guard)', async () => {
    const db = makeDb({
      dataset: {
        id: 'd1',
        name: 'Focus engagement aggregates',
        description: '',
        dataset_type: 'study_engagement',
        cohort_filters: { country: 'India' },
        price_currency: 'OCEAN',
        price_amount: 10,
        status: 'draft',
        did: null,
        privacy_report: null,
        checksum: null,
        created_at: new Date(),
        published_at: null,
        revoked_at: null,
      },
      consenting: 5,
      total: 60,
    });
    const svc = makeService(db, makeOcean());
    await expect(svc.publishDataset('admin1', 'd1', 'publish it')).rejects.toThrow(
      /Privacy guard blocked/,
    );
  });

  it('publishes metadata-first when consent coverage and cohort size are met', async () => {
    const ocean = makeOcean();
    const db = makeDb({
      dataset: {
        id: 'd1',
        name: 'Focus engagement aggregates',
        description: 'Aggregate focus stats',
        dataset_type: 'study_engagement',
        cohort_filters: { country: 'India' },
        price_currency: 'OCEAN',
        price_amount: 10,
        status: 'draft',
        did: null,
        privacy_report: null,
        checksum: null,
        created_at: new Date(),
        published_at: null,
        revoked_at: null,
      },
      consenting: 50,
      total: 60,
    });
    const svc = makeService(db, ocean);
    const view = await svc.publishDataset('admin1', 'd1', 'publish it');
    expect(view.status).toBe('published');
    expect(view.did).toBe('did:op:1:deadbeef');
    expect(view.nftAddress).toBeNull();
    expect(ocean.buildDdo).toHaveBeenCalled();
    expect(ocean.publishMetadata).toHaveBeenCalled();
    const report = view.privacyReport as Record<string, unknown>;
    expect(report.cohortSize).toBe(50);
    expect(report.consentCoverage as number).toBeCloseTo(50 / 60);
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.publish')).toBe(true);
  });

  it('publishes a full on-chain C2D asset when a wallet is configured', async () => {
    const ocean = makeOcean();
    const c2d = makeC2D({ configured: true });
    const storage = makeStorage();
    const db = makeDb({
      dataset: {
        id: 'd1',
        name: 'Focus engagement aggregates',
        description: 'Aggregate focus stats',
        dataset_type: 'study_engagement',
        cohort_filters: { country: 'India' },
        price_currency: 'OCEAN',
        price_amount: 10,
        status: 'draft',
        did: null,
        privacy_report: null,
        checksum: null,
        created_at: new Date(),
        published_at: null,
        revoked_at: null,
      },
      consenting: 50,
      total: 60,
    });
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
    expect(c2dInput.policy.allowNetworkAccess).toBe(false);
    // The real C2D DDO is stored instead of the metadata-first DDO.
    expect(ocean.buildDdo).not.toHaveBeenCalled();
    expect(ocean.publishMetadata).not.toHaveBeenCalled();
  });

  it('falls back to metadata-first and records c2d_error when C2D fails', async () => {
    const ocean = makeOcean();
    const c2d = makeC2D({
      configured: true,
      c2dResult: { ok: false, reason: 'Insufficient MATIC for gas' },
    });
    const db = makeDb({
      dataset: {
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
      },
      consenting: 50,
      total: 60,
    });
    const svc = makeService(db, ocean, c2d, makeStorage());
    const view = await svc.publishDataset('admin1', 'd1', 'publish it');
    expect(view.status).toBe('published');
    expect(view.did).toBe('did:op:1:deadbeef');
    expect(view.nftAddress).toBeNull();
    expect(view.c2dError).toBe('Insufficient MATIC for gas');
    expect(ocean.publishMetadata).toHaveBeenCalled();
    const report = view.privacyReport as Record<string, unknown>;
    expect((report.c2d as { published: boolean }).published).toBe(false);
  });

  it('passes a per-dataset C2D policy override to the publisher', async () => {
    const ocean = makeOcean();
    const c2d = makeC2D({ configured: true });
    const db = makeDb({
      dataset: {
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
      },
      consenting: 50,
      total: 60,
    });
    const svc = makeService(db, ocean, c2d, makeStorage());
    await svc.publishDataset('admin1', 'd1', 'publish it', {
      allowRawAlgorithm: false,
      allowNetworkAccess: true,
      trustedAlgorithmPublishers: ['0xAlgoPub'],
    });
    const c2dInput = c2d.publishComputeAsset.mock.calls[0][0] as {
      policy: {
        allowRawAlgorithm: boolean;
        allowNetworkAccess: boolean;
        trustedAlgorithmPublishers: string[];
      };
    };
    expect(c2dInput.policy.allowRawAlgorithm).toBe(false);
    expect(c2dInput.policy.allowNetworkAccess).toBe(true);
    expect(c2dInput.policy.trustedAlgorithmPublishers).toEqual(['0xAlgoPub']);
  });

  it('revokes a dataset and audits the action', async () => {
    const db = makeDb({
      dataset: {
        id: 'd1',
        name: 'Focus engagement aggregates',
        description: '',
        dataset_type: 'study_engagement',
        cohort_filters: {},
        price_currency: 'OCEAN',
        price_amount: 10,
        status: 'published',
        did: 'did:op:1:x',
        privacy_report: {},
        checksum: 'abc',
        created_at: new Date(),
        published_at: new Date(),
        revoked_at: null,
      },
    });
    const svc = makeService(db, makeOcean());
    const view = await svc.revokeDataset('admin1', 'd1', 'no longer valid');
    expect(view.status).toBe('revoked');
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.revoke')).toBe(true);
  });
});
