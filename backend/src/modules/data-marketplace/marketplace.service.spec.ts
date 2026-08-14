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

const baseInput = {
  name: 'Focus engagement aggregates',
  datasetType: 'study_engagement' as const,
  reason: 'Admin dataset for market research',
  cohortFilters: { country: 'India' },
};

describe('MarketplaceService', () => {
  it('records consent opt-in and an audit row', async () => {
    const db = makeDb();
    const svc = new MarketplaceService(db as never, makeOcean() as never);
    const view = await svc.setConsent('u1', true);
    expect(view.consented).toBe(true);
    expect(db.store.consent.length).toBe(1);
    const audit = db.store.audits.find((a) => a.action === 'data_consent.change');
    expect(audit).toBeTruthy();
    expect(audit!.details).toContain('"consented":true');
  });

  it('rejects unknown dataset types', async () => {
    const db = makeDb();
    const svc = new MarketplaceService(db as never, makeOcean() as never);
    await expect(
      svc.createDataset('admin1', { ...baseInput, datasetType: 'raw_rows' as never }),
    ).rejects.toThrow(/datasetType must be one of/);
  });

  it('creates a draft dataset with audit trail', async () => {
    const db = makeDb();
    const svc = new MarketplaceService(db as never, makeOcean() as never);
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
    const svc = new MarketplaceService(db as never, makeOcean() as never);
    await expect(svc.publishDataset('admin1', 'd1', 'publish it')).rejects.toThrow(
      /Privacy guard blocked/,
    );
  });

  it('publishes when consent coverage and cohort size are met', async () => {
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
    const svc = new MarketplaceService(db as never, ocean as never);
    const view = await svc.publishDataset('admin1', 'd1', 'publish it');
    expect(view.status).toBe('published');
    expect(view.did).toBe('did:op:1:deadbeef');
    expect(ocean.buildDdo).toHaveBeenCalled();
    expect(ocean.publishMetadata).toHaveBeenCalled();
    const report = view.privacyReport as Record<string, unknown>;
    expect(report.cohortSize).toBe(50);
    expect(report.consentCoverage as number).toBeCloseTo(50 / 60);
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.publish')).toBe(true);
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
    const svc = new MarketplaceService(db as never, makeOcean() as never);
    const view = await svc.revokeDataset('admin1', 'd1', 'no longer valid');
    expect(view.status).toBe('revoked');
    expect(db.store.audits.some((a) => a.action === 'data_marketplace.revoke')).toBe(true);
  });
});
