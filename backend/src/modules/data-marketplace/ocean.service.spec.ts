import { OceanService, mintDid } from './ocean.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    OCEAN_AQUARIUS_URL: '',
    MARKETPLACE_ENABLED: 'true',
    OCEAN_PUBLISHER_ADDRESS: '0x0000000000000000000000000000000000000001',
    OCEAN_CHAIN_ID: '1',
    MARKETPLACE_PUBLISH_ENABLED: 'true',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

const input = {
  name: 'Quiz accuracy trends',
  description: 'Aggregate quiz accuracy statistics (consenting cohort only).',
  datasetType: 'academic_outcomes',
  priceCurrency: 'OCEAN',
  priceAmount: 10,
  checksum: 'abc123',
  cohortSize: 120,
  consentCoverage: 0.93,
  license: 'CC-BY-4.0 (aggregate statistics only)',
  author: 'Study RPG (Real-Nightmare)',
};

describe('OceanService', () => {
  it('mints a deterministic did:op DID from metadata', () => {
    const a = mintDid('{"x":1}', 1);
    const b = mintDid('{"x":1}', 1);
    const c = mintDid('{"x":2}', 1);
    expect(a).toMatch(/^did:op:1:[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('builds a privacy-first DDO with checksum and cohort stats only', () => {
    const svc = new OceanService(makeConfig() as never);
    const ddo = svc.buildDdo(input, new Date('2026-08-14T00:00:00Z'));
    expect(ddo.id).toMatch(/^did:op:1:/);
    expect(ddo.metadata.type).toBe('dataset');
    expect(ddo.metadata.additionalInformation.cohortSize).toBe(120);
    expect(ddo.metadata.additionalInformation.consentCoverage).toBe(0.93);
    expect(ddo.metadata.additionalInformation.price).toEqual({ currency: 'OCEAN', amount: 10 });
    expect(ddo.services[0].files[0].checksum).toBe('abc123');
    expect(ddo.services[0].files[0].checksumType).toBe('sha256');
    expect(JSON.stringify(ddo)).not.toContain('email');
    expect(JSON.stringify(ddo)).not.toContain('user_id');
  });

  it('defaults to the mainnet Aquarius URL when unset', () => {
    const svc = new OceanService(makeConfig({ OCEAN_AQUARIUS_URL: '' }) as never);
    expect(svc.getConfig().aquariusUrl).toBe('https://aquarius.mainnet.oceanprotocol.com');
  });

  it('refuses to publish when the master switch is off (no throw, draft kept)', async () => {
    const svc = new OceanService(
      makeConfig({
        OCEAN_AQUARIUS_URL: 'https://aquarius.example.com',
        MARKETPLACE_ENABLED: undefined,
      }) as never,
    );
    const ddo = svc.buildDdo(input);
    const result = await svc.publishMetadata(ddo);
    expect(result.published).toBe(false);
    expect(result.did).toBe(ddo.id);
    expect(result.reason).toContain('MARKETPLACE_ENABLED=false');
  });

  it('reports the disabled publish mode while MARKETPLACE_ENABLED is unset', () => {
    const svc = new OceanService(makeConfig({ MARKETPLACE_ENABLED: undefined }) as never);
    expect(svc.getStatus().publishMode).toBe('disabled');
    expect(svc.getStatus().enabled).toBe(false);
  });

  it('attempts the Aquarius POST when configured and reports failures without throwing', async () => {
    const svc = new OceanService(
      makeConfig({ OCEAN_AQUARIUS_URL: 'https://aquarius.example.com' }) as never,
    );
    const ddo = svc.buildDdo(input);
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 }) as never;
    try {
      const result = await svc.publishMetadata(ddo);
      expect(result.published).toBe(true);
      expect(result.httpStatus).toBe(201);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://aquarius.example.com/api/aquarius/assets/ddo',
        expect.objectContaining({ method: 'POST' }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
