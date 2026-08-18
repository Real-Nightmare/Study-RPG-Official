/**
 * Ocean Protocol integration (owner brief).
 *
 * Publishes *aggregate* educational datasets to the Ocean ecosystem as
 * discoverable assets. Design constraints enforced here:
 *
 *   1. Only the aggregate payload ever leaves this module — never raw rows,
 *      never free text, never per-user values. The payload is additionally
 *      run through `privacy-guard.ts` by the caller before it reaches us.
 *   2. A SHA-256 checksum of the aggregate payload is embedded in the DDO
 *      `files` entry so buyers can verify the data they receive matches what
 *      was published.
 *   3. Nothing is sent unless the marketplace is configured and enabled
 *      (`OCEAN_AQUARIUS_URL` + `MARKETPLACE_PUBLISH_ENABLED`). Unconfigured
 *      publishes are recorded as drafts with `published: false` — the DDO is
 *      still stored so it can be re-submitted or exported for manual upload.
 *   4. Publisher credentials (wallet address/key) are optional and never
 *      logged. This service completes the *metadata-first* publish step and
 *      keeps the DDO re-submittable; the real on-chain path — deploying the
 *      ERC721 + datatoken and registering a compute-to-data service — lives in
 *      `ocean-c2d.service.ts` and is used automatically when a funded wallet,
 *      an RPC URL and an Ocean Node are configured.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { getMarketplaceConfig, MarketplaceConfig, OceanNetwork } from './marketplace-config';

export interface DdoInput {
  name: string;
  description: string;
  datasetType: string;
  priceCurrency: string;
  priceAmount: number;
  checksum: string;
  cohortSize: number;
  consentCoverage: number;
  license: string;
  author: string;
}

export interface OceanPublishResult {
  published: boolean;
  did: string;
  reason?: string;
  httpStatus?: number;
}

export interface OceanDdo {
  '@context': string;
  id: string;
  created: string;
  updated: string;
  version: string;
  chainId: number;
  nftAddress: string | null;
  metadata: {
    type: 'dataset';
    name: string;
    description: string;
    author: string;
    license: string;
    tags: string[];
    additionalInformation: {
      datasetType: string;
      price: { currency: string; amount: number };
      cohortSize: number;
      consentCoverage: number;
      generatedBy: 'Study RPG data marketplace';
    };
  };
  services: Array<{
    id: string;
    type: 'compute' | 'access';
    name: string;
    description: string;
    files: Array<{ name: string; contentType: string; checksum: string; checksumType: string }>;
    cost: { price: number; currency: string };
  }>;
}

/** Deterministic did:op DID derived from the canonical metadata hash. */
export function mintDid(metadataJson: string, chainId: number): string {
  const hash = createHash('sha256').update(metadataJson).digest('hex').slice(0, 64);
  return `did:op:${chainId}:${hash}`;
}

@Injectable()
export class OceanService {
  private readonly logger = new Logger(OceanService.name);

  constructor(private readonly config: ConfigService) {}

  getConfig(): MarketplaceConfig {
    const get = (key: string) => this.config.get<string>(key);
    return getMarketplaceConfig({
      OCEAN_AQUARIUS_URL: get('OCEAN_AQUARIUS_URL'),
      OCEAN_PUBLISHER_ADDRESS: get('OCEAN_PUBLISHER_ADDRESS'),
      OCEAN_PUBLISHER_PRIVATE_KEY: get('OCEAN_PUBLISHER_PRIVATE_KEY'),
      OCEAN_CHAIN_ID: get('OCEAN_CHAIN_ID'),
      MARKETPLACE_PUBLISH_ENABLED: get('MARKETPLACE_PUBLISH_ENABLED'),
      MARKETPLACE_MIN_GROUP_SIZE: get('MARKETPLACE_MIN_GROUP_SIZE'),
      MARKETPLACE_CONSENT_THRESHOLD: get('MARKETPLACE_CONSENT_THRESHOLD'),
      MARKETPLACE_DATASET_LICENSE: get('MARKETPLACE_DATASET_LICENSE'),
      MARKETPLACE_AGGREGATE_WINDOW_DAYS: get('MARKETPLACE_AGGREGATE_WINDOW_DAYS'),
    });
  }

  /**
   * Operational status for the admin UI. The marketplace never requires a
   * funded wallet: metadata-first publish (Aquarius) works with no wallet at
   * all, and the on-chain datatoken mint is a documented follow-up that only
   * needs OCEAN_PUBLISHER_ADDRESS + OCEAN_PUBLISHER_PRIVATE_KEY once you're
   * ready to fund it.
   */
  getStatus(): {
    publishMode: 'disabled' | 'metadata-first' | 'on-chain-ready';
    aquariusConfigured: boolean;
    walletConfigured: boolean;
    network: OceanNetwork;
    chainId: number;
  } {
    const cfg = this.getConfig();
    const aquariusConfigured = cfg.publishEnabled && !!cfg.aquariusUrl;
    const walletConfigured = !!cfg.publisherAddress && !!cfg.publisherPrivateKey;
    return {
      publishMode: !aquariusConfigured
        ? 'disabled'
        : walletConfigured
          ? 'on-chain-ready'
          : 'metadata-first',
      aquariusConfigured,
      walletConfigured,
      network: cfg.network,
      chainId: cfg.chainId,
    };
  }

  /** Build the Ocean DDO for an aggregate dataset (pure, testable). */
  buildDdo(input: DdoInput, now = new Date()): OceanDdo {
    const cfg = this.getConfig();
    const did = mintDid(JSON.stringify({ ...input, ts: now.toISOString() }), cfg.chainId);
    const serviceId = `service-${did.slice(-16)}`;
    return {
      '@context': 'https://w3id.org/did-resolution/v1',
      id: did,
      created: now.toISOString(),
      updated: now.toISOString(),
      version: '0.1',
      chainId: cfg.chainId,
      nftAddress: cfg.publisherAddress,
      metadata: {
        type: 'dataset',
        name: input.name,
        description: input.description,
        author: input.author,
        license: input.license,
        tags: ['study-rpg', 'education', 'aggregate', input.datasetType],
        additionalInformation: {
          datasetType: input.datasetType,
          price: { currency: input.priceCurrency, amount: input.priceAmount },
          cohortSize: input.cohortSize,
          consentCoverage: Number(input.consentCoverage.toFixed(4)),
          generatedBy: 'Study RPG data marketplace',
        },
      },
      services: [
        {
          id: serviceId,
          type: 'compute',
          name: `${input.name} (aggregate)`,
          description:
            'Aggregate statistics only. No raw rows, no free text, no personally identifiable information. Buyers receive the SHA-256 checksummed aggregate payload.',
          files: [
            {
              name: `${input.datasetType}-aggregate.json`,
              contentType: 'application/json',
              checksum: input.checksum,
              checksumType: 'sha256',
            },
          ],
          cost: { price: input.priceAmount, currency: input.priceCurrency },
        },
      ],
    };
  }

  /**
   * Publish DDO metadata to Aquarius. Never throws on network failure — the
   * DDO is stored by the caller and can be re-submitted later.
   */
  async publishMetadata(ddo: OceanDdo): Promise<OceanPublishResult> {
    const cfg = this.getConfig();
    if (!cfg.publishEnabled || !cfg.aquariusUrl) {
      const reason = 'Ocean publish disabled or unconfigured (OCEAN_AQUARIUS_URL).';
      this.logger.warn(reason);
      return { published: false, did: ddo.id, reason };
    }

    try {
      const res = await fetch(`${cfg.aquariusUrl}/api/aquarius/assets/ddo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ddo),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Aquarius publish failed (${res.status}): ${body.slice(0, 300)}`);
        return {
          published: false,
          did: ddo.id,
          reason: `Aquarius responded ${res.status}`,
          httpStatus: res.status,
        };
      }
      this.logger.log(`DDO published to Aquarius: ${ddo.id}`);
      return { published: true, did: ddo.id, httpStatus: res.status };
    } catch (err) {
      this.logger.warn(
        `Aquarius publish error (DDO kept for re-submission): ${(err as Error).message}`,
      );
      return {
        published: false,
        did: ddo.id,
        reason: `Network error: ${(err as Error).message}`,
      };
    }
  }
}
