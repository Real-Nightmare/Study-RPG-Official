/**
 * Unit tests for the on-chain Compute-to-Data publisher (OceanC2DService).
 * The Ocean.js SDK and ethers RPC are mocked — no network, no wallet, no gas.
 */

import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { getAddress } from 'ethers';
import { OceanC2DService } from './ocean-c2d.service';
import type { ComputeAssetInput } from './ocean-c2d.service';

const NFT_ADDRESS = '0x6fd867E5AEE6D62a24f97939db90C4e67A73A651';
const DT_ADDRESS = '0x8B8E187CF9c551e63f54AA04E21F48CDAF2296aE';

jest.mock('@oceanprotocol/lib', () => {
  const encrypt = jest.fn(async (_data: unknown, _chainId: number) => 'encrypted:payload');
  const createNftWithDatatoken = jest.fn(async () => ({
    wait: jest.fn(async () => ({ hash: '0xCreateHash' })),
  }));
  const createNftWithDatatokenWithFixedRate = jest.fn(async () => ({
    wait: jest.fn(async () => ({ hash: '0xCreateHash' })),
  }));
  const setMetadata = jest.fn(async () => ({
    wait: jest.fn(async () => ({ hash: '0xMetaHash' })),
  }));
  const validate = jest.fn(async () => ({ hash: '0xMetadataHash' }));
  return {
    // Named exports mirror the inner mocks so tests can assert on the calls.
    encrypt,
    createNftWithDatatoken,
    createNftWithDatatokenWithFixedRate,
    setMetadata,
    validate,
    NftFactory: jest.fn().mockImplementation(() => ({
      createNftWithDatatoken,
      createNftWithDatatokenWithFixedRate,
    })),
    Nft: jest.fn().mockImplementation(() => ({ setMetadata })),
    Aquarius: jest.fn().mockImplementation(() => ({ validate })),
    ProviderInstance: { encrypt },
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    getEventFromTx: jest.fn((_tx: unknown, event: string) => ({
      args:
        event === 'NFTCreated'
          ? { newTokenAddress: NFT_ADDRESS }
          : event === 'TokenCreated'
            ? { newTokenAddress: DT_ADDRESS }
            : { exchangeId: '0xExchangeId' },
    })),
  };
});

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getNetwork: jest.fn(async () => ({ chainId: 137n })),
  })),
}));

function makeService(env: Record<string, string | undefined> = {}) {
  return new OceanC2DService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

const baseInput: ComputeAssetInput = {
  name: 'Focus engagement aggregates',
  description: 'Aggregate focus statistics',
  datasetType: 'study_engagement',
  priceCurrency: 'OCEAN',
  priceAmount: 10,
  checksum: 'a'.repeat(64),
  cohortSize: 50,
  consentCoverage: 0.83,
  license: 'CC-BY-4.0 (aggregate statistics only)',
  author: 'Study RPG',
  fileUrl: 'https://cdn.example.com/marketplace/agg.json',
  policy: { allowRawAlgorithm: true, allowNetworkAccess: false, trustedAlgorithmPublishers: [] },
};

const walletEnv = {
  MARKETPLACE_ENABLED: 'true',
  OCEAN_PUBLISHER_PRIVATE_KEY: '0x' + '11'.repeat(32),
  OCEAN_PUBLISHER_ADDRESS: '0x6fd867E5AEE6D62a24f97939db90C4e67A73A651',
};

describe('OceanC2DService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses everything while the marketplace master switch is off', async () => {
    const result = await makeService({
      ...walletEnv,
      MARKETPLACE_ENABLED: undefined,
    }).publishComputeAsset(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('MARKETPLACE_ENABLED=false');
  });

  it('rejects any policy that asks for compute-job network access', async () => {
    const result = await makeService(walletEnv).publishComputeAsset({
      ...baseInput,
      policy: { allowRawAlgorithm: true, allowNetworkAccess: true, trustedAlgorithmPublishers: [] },
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('network access can never be enabled');
  });

  it('reports not on-chain-ready without a wallet', () => {
    const status = makeService().getStatus();
    expect(status.onChainReady).toBe(false);
    expect(status.walletConfigured).toBe(false);
  });

  it('reports on-chain-ready when wallet + RPC + node + factory are configured', () => {
    const status = makeService({ ...walletEnv }).getStatus();
    expect(status.onChainReady).toBe(true);
    expect(status.chainId).toBe(137);
    expect(status.providerUrl).toMatch(/^https:\/\/compute1\.oceanprotocol\.com\/$/);
  });

  it('refuses to publish without a funded wallet', async () => {
    const result = await makeService({ MARKETPLACE_ENABLED: 'true' }).publishComputeAsset(
      baseInput,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('OCEAN_PUBLISHER_PRIVATE_KEY');
  });

  it('refuses non-public file URLs (storage must expose the aggregate)', async () => {
    const result = await makeService(walletEnv).publishComputeAsset({
      ...baseInput,
      fileUrl: 'marketplace/agg.json',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('R2_PUBLIC_URL');
  });

  it('deploys NFT + datatoken + fixed-rate exchange and stores the DDO on-chain', async () => {
    const service = makeService(walletEnv);
    const lib = jest.requireMock('@oceanprotocol/lib');
    const result = await service.publishComputeAsset(baseInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // DID = did:op:sha256(checksummed nftAddress + chainId)
    const expectedDid =
      'did:op:' +
      createHash('sha256')
        .update(getAddress(NFT_ADDRESS) + '137')
        .digest('hex');
    expect(result.did).toBe(expectedDid);
    expect(result.nftAddress).toBe(NFT_ADDRESS);
    expect(result.datatokenAddress).toBe(DT_ADDRESS);
    expect(result.exchangeId).toBe('0xExchangeId');
    expect(result.chainId).toBe(137);
    expect(result.transactions).toEqual({ create: '0xCreateHash', setMetadata: '0xMetaHash' });

    // A priced dataset bundles a fixed-rate exchange.
    expect(lib.NftFactory).toHaveBeenCalledWith(
      '0x6fd867E5AEE6D62a24f97939db90C4e67A73A651',
      expect.anything(),
      137,
    );
    const freCall = lib.createNftWithDatatokenWithFixedRate.mock.calls[0];
    expect(freCall[2].fixedRate).toBe('10000000000000000000'); // 10 OCEAN (18 decimals)
    expect(freCall[2].withMint).toBe(true);

    // The DDO has a compute service with the C2D policy stamped in.
    const ddo = result.ddo;
    expect(ddo.services[0].type).toBe('compute');
    expect(ddo.services[0].datatokenAddress).toBe(DT_ADDRESS);
    expect(ddo.services[0].serviceEndpoint).toBe('https://compute1.oceanprotocol.com/');
    expect(ddo.services[0].compute).toEqual({
      allowRawAlgorithm: true,
      allowNetworkAccess: false,
      publisherTrustedAlgorithmPublishers: [],
      publisherTrustedAlgorithms: [],
    });
    // Files were encrypted with the node.
    expect(lib.ProviderInstance.encrypt).toHaveBeenCalled();
    // Metadata was set on-chain with the validated, encrypted DDO.
    expect(lib.Aquarius).toHaveBeenCalledWith('https://compute1.oceanprotocol.com/');
    expect(lib.setMetadata).toHaveBeenCalled();
  });

  it('skips the fixed-rate exchange for free datasets', async () => {
    const service = makeService(walletEnv);
    const lib = jest.requireMock('@oceanprotocol/lib');
    const result = await service.publishComputeAsset({ ...baseInput, priceAmount: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exchangeId).toBeNull();
    expect(lib.createNftWithDatatoken).toHaveBeenCalled();
    expect(lib.createNftWithDatatokenWithFixedRate).not.toHaveBeenCalled();
  });

  it('returns a failure instead of throwing when the node is unreachable', async () => {
    const lib = jest.requireMock('@oceanprotocol/lib');
    (lib.ProviderInstance.encrypt as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED compute1.oceanprotocol.com'),
    );
    const service = makeService(walletEnv);
    const result = await service.publishComputeAsset(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('ECONNREFUSED');
    (lib.ProviderInstance.encrypt as jest.Mock).mockClear();
  });
});
