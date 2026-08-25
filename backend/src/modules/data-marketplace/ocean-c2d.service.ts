/**
 * Ocean Protocol Compute-to-Data (C2D) publisher — THE ONLY publish path
 * (owner policy: "the data marketplace should be very strict to not sell PII
 * related things; it should only allow Compute 2 Data").
 *
 * Using the official Ocean.js SDK (`@oceanprotocol/lib`):
 *
 *   1. Deploy an ERC721 data NFT + ERC20 datatoken for the aggregate
 *      (one transaction; a fixed-rate exchange is bundled when a price is
 *      set, so buyers can swap OCEAN → datatoken and run compute jobs).
 *   2. Encrypt the aggregate file URL with the Ocean Node (ProviderInstance).
 *   3. Build the DDO with a `compute` service — NEVER an access/download
 *      service — with the privacy policy (raw algorithm on/off, network
 *      access permanently off, optional algorithm-publisher allowlist),
 *      the datatoken address and the node as the compute endpoint.
 *   4. Validate + store the DDO on-chain (ERC725 metadata store) via the
 *      Ocean Node, so Aquarius/indexers resolve it.
 *
 * Safety model (inherited from the marketplace service): only sanitized
 * numeric aggregates ever reach this service, the SHA-256 checksum is stamped
 * into the DDO so buyers can verify what they received, network access for
 * compute jobs is refused outright if requested, and researchers can exercise
 * the same flow locally through the isolated `c2d-runner` container.
 *
 * Everything is best-effort and wallet-optional at boot: without a funded
 * wallet, an RPC URL or a reachable node this service reports why and the
 * caller keeps the dataset as a draft. It never throws.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { getAddress, JsonRpcProvider, parseEther, toBeHex, Wallet } from 'ethers';
import {
  Aquarius,
  getEventFromTx,
  Nft,
  NftFactory,
  ProviderInstance,
  ZERO_ADDRESS,
} from '@oceanprotocol/lib';
import type { DatatokenCreateParams, NftCreateData } from '@oceanprotocol/lib';
import type { DDO } from '@oceanprotocol/ddo-js';
import { getMarketplaceConfig, MarketplaceConfig } from './marketplace-config';

export interface C2DPolicy {
  /** Allow buyers/researchers to submit raw algorithm code against the aggregate. */
  allowRawAlgorithm: boolean;
  /**
   * Allow compute jobs to reach the public internet. Typed `false`: this is a
   * hard invariant of the platform — compute jobs never get network access,
   * so nothing inside the compute environment can exfiltrate data.
   */
  allowNetworkAccess: false;
  /** Allowlist of algorithm publisher addresses (empty = any published algorithm). */
  trustedAlgorithmPublishers: string[];
}

export interface ComputeAssetInput {
  name: string;
  description: string;
  datasetType: string;
  priceCurrency: string;
  priceAmount: number;
  /** SHA-256 of the exact aggregate payload that will be computed on. */
  checksum: string;
  cohortSize: number;
  consentCoverage: number;
  license: string;
  author: string;
  /** Public URL of the sanitized aggregate JSON (the Ocean Node fetches this). */
  fileUrl: string;
  policy: C2DPolicy;
}

export interface ComputeAssetResult {
  ok: true;
  did: string;
  nftAddress: string;
  datatokenAddress: string;
  exchangeId: string | null;
  providerUrl: string;
  chainId: number;
  /** The DDO that was validated and stored on-chain (kept for the audit trail). */
  ddo: DDO;
  /** Transaction hashes of the two on-chain steps (create + setMetadata). */
  transactions: { create: string; setMetadata: string };
}

export interface ComputeAssetFailure {
  ok: false;
  reason: string;
}

export interface C2DStatus {
  /** All pieces configured: wallet, RPC, node URL, factory address. */
  onChainReady: boolean;
  /** Wallet private key present (funds the on-chain transactions). */
  walletConfigured: boolean;
  /** RPC URL configured. */
  rpcConfigured: boolean;
  /** Ocean Node URL configured (encryption + compute endpoint). */
  nodeConfigured: boolean;
  /** ERC721Factory address resolved for the configured chain. */
  factoryConfigured: boolean;
  chainId: number;
  providerUrl: string;
}

@Injectable()
export class OceanC2DService {
  private readonly logger = new Logger(OceanC2DService.name);

  constructor(private readonly config: ConfigService) {}

  getConfig(): MarketplaceConfig {
    const get = (key: string) => this.config.get<string>(key);
    return getMarketplaceConfig({
      MARKETPLACE_ENABLED: get('MARKETPLACE_ENABLED'),
      OCEAN_AQUARIUS_URL: get('OCEAN_AQUARIUS_URL'),
      OCEAN_PUBLISHER_ADDRESS: get('OCEAN_PUBLISHER_ADDRESS'),
      OCEAN_PUBLISHER_PRIVATE_KEY: get('OCEAN_PUBLISHER_PRIVATE_KEY'),
      OCEAN_CHAIN_ID: get('OCEAN_CHAIN_ID'),
      MARKETPLACE_PUBLISH_ENABLED: get('MARKETPLACE_PUBLISH_ENABLED'),
      MARKETPLACE_MIN_GROUP_SIZE: get('MARKETPLACE_MIN_GROUP_SIZE'),
      MARKETPLACE_CONSENT_THRESHOLD: get('MARKETPLACE_CONSENT_THRESHOLD'),
      MARKETPLACE_DATASET_LICENSE: get('MARKETPLACE_DATASET_LICENSE'),
      MARKETPLACE_AGGREGATE_WINDOW_DAYS: get('MARKETPLACE_AGGREGATE_WINDOW_DAYS'),
      OCEAN_NODE_URL: get('OCEAN_NODE_URL'),
      OCEAN_RPC_URL: get('OCEAN_RPC_URL'),
      OCEAN_ERC721_FACTORY: get('OCEAN_ERC721_FACTORY'),
      OCEAN_FIXED_RATE_EXCHANGE: get('OCEAN_FIXED_RATE_EXCHANGE'),
      OCEAN_TOKEN_ADDRESS: get('OCEAN_TOKEN_ADDRESS'),
      OCEAN_C2D_ALLOW_RAW_ALGORITHM: get('OCEAN_C2D_ALLOW_RAW_ALGORITHM'),
      OCEAN_C2D_TRUSTED_ALGORITHM_PUBLISHERS: get('OCEAN_C2D_TRUSTED_ALGORITHM_PUBLISHERS'),
    });
  }

  /** Readiness for on-chain C2D publishing (shown in the admin status UI). */
  getStatus(): C2DStatus {
    const cfg = this.getConfig();
    const walletConfigured = !!cfg.publisherPrivateKey;
    const rpcConfigured = !!cfg.rpcUrl;
    const nodeConfigured = !!cfg.nodeUrl;
    const factoryConfigured = !!cfg.factoryAddress;
    return {
      onChainReady: walletConfigured && rpcConfigured && nodeConfigured && factoryConfigured,
      walletConfigured,
      rpcConfigured,
      nodeConfigured,
      factoryConfigured,
      chainId: cfg.chainId,
      providerUrl: cfg.nodeUrl,
    };
  }

  /**
   * Publish an aggregate as a real compute-to-data asset on the configured
   * chain. Never throws — every failure is returned as `{ ok: false, reason }`
   * so the caller can keep the dataset as a draft (strict C2D-only).
   */
  async publishComputeAsset(
    input: ComputeAssetInput,
  ): Promise<ComputeAssetResult | ComputeAssetFailure> {
    const cfg = this.getConfig();

    if (!cfg.enabled) {
      return {
        ok: false,
        reason:
          'Data marketplace is disabled (MARKETPLACE_ENABLED=false) — nothing is ever published.',
      };
    }
    // Hard invariant: compute-to-data only, and compute jobs never get
    // network access. Refuse anything else rather than silently fixing it.
    if (input.policy.allowNetworkAccess !== false) {
      return {
        ok: false,
        reason: 'C2D policy violation: network access can never be enabled for compute jobs.',
      };
    }
    if (!cfg.publishEnabled) {
      return { ok: false, reason: 'MARKETPLACE_PUBLISH_ENABLED=false — publishing disabled.' };
    }
    if (!cfg.publisherPrivateKey) {
      return {
        ok: false,
        reason:
          'C2D publish needs a funded wallet: set OCEAN_PUBLISHER_PRIVATE_KEY (+ OCEAN_PUBLISHER_ADDRESS).',
      };
    }
    if (!cfg.rpcUrl) {
      return { ok: false, reason: 'OCEAN_RPC_URL is not configured.' };
    }
    if (!cfg.nodeUrl) {
      return { ok: false, reason: 'OCEAN_NODE_URL is not configured.' };
    }
    if (!cfg.factoryAddress) {
      return {
        ok: false,
        reason: `OCEAN_ERC721_FACTORY is not configured for chain ${cfg.chainId}.`,
      };
    }
    if (input.priceAmount > 0 && !cfg.fixedRateExchangeAddress) {
      return {
        ok: false,
        reason: 'OCEAN_FIXED_RATE_EXCHANGE is not configured (needed to price the datatoken).',
      };
    }
    if (!/^https?:\/\//.test(input.fileUrl)) {
      return {
        ok: false,
        reason:
          'Aggregate file URL must be public (https) so the Ocean Node can fetch it — configure R2_PUBLIC_URL.',
      };
    }

    const provider = new JsonRpcProvider(cfg.rpcUrl);
    const signer = new Wallet(cfg.publisherPrivateKey, provider);

    try {
      const { chainId } = await provider.getNetwork();
      const owner = await signer.getAddress();

      // ---------------------------------------------------------------------
      // 1) Deploy ERC721 data NFT + ERC20 datatoken (+ fixed-rate exchange)
      // ---------------------------------------------------------------------
      const nftFactory = new NftFactory(cfg.factoryAddress, signer, Number(chainId));
      const nftParams: NftCreateData = {
        name: input.name.slice(0, 200),
        symbol: `SRP-${input.datasetType.slice(0, 4).toUpperCase()}`,
        templateIndex: 1,
        tokenURI: 'https://study-rpg.app/assets/dataset',
        transferable: true,
        owner,
      };
      const dtParams: DatatokenCreateParams = {
        templateIndex: 1,
        cap: '100000',
        feeAmount: '0',
        paymentCollector: owner,
        feeToken: ZERO_ADDRESS,
        minter: owner,
        mpFeeAddress: ZERO_ADDRESS,
      };

      let createTx;
      let freParams: {
        fixedRateAddress: string;
        baseTokenAddress: string;
        owner: string;
        marketFeeCollector: string;
        baseTokenDecimals: number;
        datatokenDecimals: number;
        fixedRate: string;
        marketFee: string;
        withMint: boolean;
      } | null = null;

      if (input.priceAmount > 0) {
        freParams = {
          fixedRateAddress: cfg.fixedRateExchangeAddress!,
          baseTokenAddress: cfg.oceanTokenAddress || ZERO_ADDRESS,
          owner,
          marketFeeCollector: owner,
          baseTokenDecimals: 18,
          datatokenDecimals: 18,
          fixedRate: parseEther(String(input.priceAmount)).toString(),
          marketFee: '0',
          withMint: true,
        };
        createTx = await nftFactory.createNftWithDatatokenWithFixedRate(
          nftParams,
          dtParams,
          freParams,
        );
      } else {
        createTx = await nftFactory.createNftWithDatatoken(nftParams, dtParams);
      }
      const createReceipt = await createTx.wait();
      if (!createReceipt) {
        return { ok: false, reason: 'NFT/datatoken deployment transaction was dropped.' };
      }
      const nftAddress = getEventFromTx(createReceipt, 'NFTCreated').args.newTokenAddress as string;
      const datatokenAddress = getEventFromTx(createReceipt, 'TokenCreated').args
        .newTokenAddress as string;
      const exchangeId = freParams
        ? (getEventFromTx(createReceipt, 'NewFixedRate').args.exchangeId as string)
        : null;

      // ---------------------------------------------------------------------
      // 2) DID + encrypted file URL (the node fetches the aggregate on demand)
      // ---------------------------------------------------------------------
      const did = `did:op:${createHash('sha256')
        .update(getAddress(nftAddress) + Number(chainId).toString(10))
        .digest('hex')}`;

      const encryptedFiles = await ProviderInstance.encrypt(
        {
          nftAddress,
          datatokenAddress,
          files: [{ type: 'url', url: input.fileUrl, method: 'GET' }],
        },
        Number(chainId),
        cfg.nodeUrl,
        signer,
        undefined,
        AbortSignal.timeout(30_000),
      );

      // ---------------------------------------------------------------------
      // 3) DDO with a compute service (privacy policy stamped in)
      // ---------------------------------------------------------------------
      const now = new Date();
      const ddo: DDO = {
        '@context': ['https://w3id.org/did/v1'],
        id: did,
        version: '4.1.0',
        chainId: Number(chainId),
        nftAddress,
        metadata: {
          created: now.toISOString(),
          updated: now.toISOString(),
          type: 'dataset',
          name: input.name,
          description: input.description,
          author: input.author,
          license: input.license,
          additionalInformation: {
            datasetType: input.datasetType,
            price: { currency: input.priceCurrency, amount: input.priceAmount },
            cohortSize: input.cohortSize,
            consentCoverage: Number(input.consentCoverage.toFixed(4)),
            checksum: input.checksum,
            generatedBy: 'Study RPG data marketplace',
          },
        },
        services: [
          {
            id: `service-${did.slice(-16)}`,
            type: 'compute',
            files: encryptedFiles,
            datatokenAddress,
            serviceEndpoint: cfg.nodeUrl,
            timeout: 3600,
            name: `${input.name} (compute-to-data)`,
            description:
              'Compute-to-data ONLY — the dataset cannot be downloaded. Algorithms run on ' +
              'the sanitized numeric aggregate inside an isolated, network-less compute ' +
              'environment; raw rows and PII never exist in the payload. Buyers can verify ' +
              'the payload with the SHA-256 checksum in the metadata.',
            compute: {
              allowRawAlgorithm: input.policy.allowRawAlgorithm,
              allowNetworkAccess: input.policy.allowNetworkAccess,
              publisherTrustedAlgorithmPublishers: input.policy.trustedAlgorithmPublishers,
              publisherTrustedAlgorithms: [],
            },
          },
        ],
      };

      // ---------------------------------------------------------------------
      // 4) Validate + store the DDO on-chain (ERC725 via the Ocean Node)
      // ---------------------------------------------------------------------
      const aquarius = new Aquarius(cfg.nodeUrl);
      const validateResult = await aquarius.validate(ddo, signer, cfg.nodeUrl);
      if (!validateResult.hash) {
        return {
          ok: false,
          reason: 'Ocean Node rejected the DDO — no metadata hash was returned by validate().',
        };
      }
      const encryptedDdo = await ProviderInstance.encrypt(
        ddo,
        Number(chainId),
        cfg.nodeUrl,
        signer,
        undefined,
        AbortSignal.timeout(30_000),
      );
      const nft = new Nft(signer, Number(chainId));
      const setMetadataTx = await nft.setMetadata(
        nftAddress,
        owner,
        0,
        cfg.nodeUrl,
        '',
        toBeHex(2),
        encryptedDdo,
        validateResult.hash,
      );
      const setMetadataReceipt = await setMetadataTx.wait();
      if (!setMetadataReceipt) {
        return { ok: false, reason: 'On-chain metadata transaction was dropped.' };
      }

      this.logger.log(
        `C2D asset published: ${did} (nft=${nftAddress}, dt=${datatokenAddress}, ` +
          `exchange=${exchangeId ?? 'none'}, chain=${chainId})`,
      );
      return {
        ok: true,
        did,
        nftAddress,
        datatokenAddress,
        exchangeId,
        providerUrl: cfg.nodeUrl,
        chainId: Number(chainId),
        ddo,
        transactions: {
          create: createReceipt.hash,
          setMetadata: setMetadataReceipt.hash,
        },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`C2D publish failed (dataset stays a draft): ${reason}`);
      return { ok: false, reason };
    }
  }
}
