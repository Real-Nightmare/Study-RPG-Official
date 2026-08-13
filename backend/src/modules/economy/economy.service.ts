import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { WalletService } from '../rpg/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupplyService } from './supply.service';

export interface ListingView {
  id: string;
  cardKey: string;
  cardName: string;
  rarity: string;
  category: string;
  ability: unknown;
  lore: string | null;
  officialValue: number;
  price: number;
  status: string;
  sellerId: string;
  sellerName: string;
  sellerUsername: string | null;
  createdAt: Date;
  expiresAt: Date;
  hasMyOffer: boolean;
}

export interface OfferView {
  id: string;
  listingId: string;
  buyerId: string;
  amount: number;
  status: string;
  createdAt: Date;
  direction: 'incoming' | 'outgoing';
  cardName: string;
  cardKey: string;
  listingPrice: number;
  otherName: string;
}

export interface CollectionCardView {
  id: string;
  cardKey: string;
  name: string;
  rarity: string;
  category: string;
  ability: unknown;
  lore: string;
  officialValue: number;
  location: 'inventory' | 'vault';
  source: string;
  inDeck: boolean;
  listed: boolean;
  createdAt: Date;
}

export interface ListCardInput {
  cardInstanceId: string;
  price: number;
}

export interface SettlementResult {
  listingId: string;
  cardName: string;
  price: number;
  buyerId: string;
  sellerId: string;
}

/**
 * Marketplace and trading (§20), inventory/vault (§18) and card ownership.
 * Every sale is atomic: buyer debit + ownership transfer + seller credit in a
 * single PostgreSQL transaction, with the listing row locked FOR UPDATE and
 * idempotent wallet entries, so double-buys and double-pays are impossible.
 */
@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    private readonly supply: SupplyService,
  ) {}

  // ---------------------------------------------------------------------------
  // Marketplace
  // ---------------------------------------------------------------------------

  async listMarketplace(
    userId: string,
    filters: { rarity?: string; cardKey?: string; mine?: boolean } = {},
  ): Promise<ListingView[]> {
    await this.expireListings();
    const conditions: string[] = ["ml.status = 'active'"];
    const values: unknown[] = [userId];
    let param = 2;
    if (filters.mine) {
      conditions.push(`ml.seller_id = $${param++}`);
      values.push(userId);
    }
    if (filters.rarity) {
      conditions.push(`cd.rarity = $${param++}`);
      values.push(filters.rarity);
    }
    if (filters.cardKey) {
      conditions.push(`cd.key = $${param++}`);
      values.push(filters.cardKey);
    }

    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ml.id, ml.price, ml.status, ml.seller_id, ml.created_at, ml.expires_at,
              cd.key AS card_key, cd.name AS card_name, cd.rarity, cd.category, cd.ability,
              cd.lore, cd.official_value,
              u.name AS seller_name, u.username AS seller_username,
              EXISTS(SELECT 1 FROM marketplace_offers mo
                     WHERE mo.listing_id = ml.id AND mo.buyer_id = $1 AND mo.status = 'pending')
                AS has_my_offer
       FROM marketplace_listings ml
       JOIN card_instances ci ON ci.id = ml.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       JOIN users u ON u.id = ml.seller_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ml.created_at DESC
       LIMIT 100`,
      values,
    );
    return rows.map((r) => this.mapListing(r));
  }

  /** §20: list an owned card at a fixed price (STP). */
  async listCard(userId: string, input: ListCardInput): Promise<ListingView> {
    if (!Number.isInteger(input.price) || input.price <= 0) {
      throw new BadRequestException('Price must be a positive integer');
    }
    const card = await this.assertSellable(userId, input.cardInstanceId);

    const existing = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM marketplace_listings
       WHERE card_instance_id = $1 AND status = 'active'`,
      [input.cardInstanceId],
    );
    if (existing) {
      throw new BadRequestException('This card is already listed');
    }

    const config = await this.supply.getConfig();
    const expiresAt = new Date(Date.now() + config.listingDurationHours * 60 * 60 * 1000);
    const id = uuidv4();
    await this.db.query(
      `INSERT INTO marketplace_listings
         (id, seller_id, card_instance_id, price, status, expires_at)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [id, userId, input.cardInstanceId, input.price, expiresAt],
    );
    this.logger.log(`Card ${input.cardInstanceId} listed by ${userId} at ${input.price} STP`);
    return this.getListingView(id);
  }

  /** §20: cancel an active listing of your own. */
  async cancelListing(userId: string, listingId: string): Promise<{ cancelled: boolean }> {
    const listing = await this.findListing(listingId);
    if (listing.seller_id !== userId) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== 'active') {
      throw new BadRequestException('Listing is no longer active');
    }
    await this.db.transaction(async (client) => {
      await client.query(`UPDATE marketplace_listings SET status = 'cancelled' WHERE id = $1`, [
        listingId,
      ]);
      await client.query(
        `UPDATE marketplace_offers SET status = 'cancelled'
         WHERE listing_id = $1 AND status = 'pending'`,
        [listingId],
      );
    });
    return { cancelled: true };
  }

  /** §20: buy a listed card at its fixed price. Atomic and idempotent. */
  async buyListing(buyerId: string, listingId: string): Promise<SettlementResult> {
    const result = await this.db.transaction<SettlementResult>(async (client) => {
      const locked = await client.query<Record<string, unknown>>(
        `SELECT ml.*, cd.name AS card_name, cd.key AS card_key
         FROM marketplace_listings ml
         JOIN card_instances ci ON ci.id = ml.card_instance_id
         JOIN card_definitions cd ON cd.key = ci.card_key
         WHERE ml.id = $1
         FOR UPDATE`,
        [listingId],
      );
      const listing = locked.rows[0];
      if (!listing) throw new NotFoundException('Listing not found');
      await this.assertActive(listing);

      const price = Number(listing.price);
      if (listing.seller_id === buyerId) {
        throw new BadRequestException('You cannot buy your own listing');
      }
      await this.assertBuyerCapacity(client, buyerId);
      const cardCheck = await client.query<{ id: string; removed_at: unknown }>(
        'SELECT id, removed_at FROM card_instances WHERE id = $1',
        [listing.card_instance_id],
      );
      if (!cardCheck.rows[0] || cardCheck.rows[0].removed_at) {
        throw new BadRequestException('The card is no longer available');
      }

      return this.settleSale(
        client,
        listing,
        buyerId,
        price,
        'marketplace_buy',
        'marketplace_sell',
      );
    });

    this.notify(
      result.sellerId,
      'success',
      'Card sold',
      `Your ${result.cardName} sold for ${result.price} STP`,
    );
    return result;
  }

  // ---------------------------------------------------------------------------
  // Offers (§20 "offers")
  // ---------------------------------------------------------------------------

  async makeOffer(buyerId: string, listingId: string, amount: number): Promise<OfferView> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Offer must be a positive integer');
    }
    const listing = await this.findListing(listingId);
    await this.assertActive(listing);
    if (listing.seller_id === buyerId) {
      throw new BadRequestException('You cannot offer on your own listing');
    }
    const id = uuidv4();
    await this.db.query(
      `INSERT INTO marketplace_offers (id, listing_id, buyer_id, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [id, listingId, buyerId, amount],
    );
    const offerRow = await this.loadOfferView(id, buyerId);
    return this.mapOffer(offerRow, buyerId);
  }

  async acceptOffer(sellerId: string, offerId: string): Promise<SettlementResult> {
    const result = await this.db.transaction<SettlementResult>(async (client) => {
      const offer = await client.query<Record<string, unknown>>(
        `SELECT mo.*, ml.seller_id AS listing_seller, ml.status AS listing_status,
                ml.expires_at AS listing_expires_at, ml.card_instance_id,
                cd.name AS card_name, cd.key AS card_key
         FROM marketplace_offers mo
         JOIN marketplace_listings ml ON ml.id = mo.listing_id
         JOIN card_instances ci ON ci.id = ml.card_instance_id
         JOIN card_definitions cd ON cd.key = ci.card_key
         WHERE mo.id = $1
         FOR UPDATE OF mo`,
        [offerId],
      );
      const row = offer.rows[0];
      if (!row || row.listing_seller !== sellerId) {
        throw new NotFoundException('Offer not found');
      }
      if (row.status !== 'pending') {
        throw new BadRequestException('Offer is no longer pending');
      }

      const listingLike = {
        id: row.listing_id as string,
        price: Number(row.amount),
        seller_id: row.listing_seller as string,
        card_name: row.card_name as string,
        card_key: row.card_key as string,
        card_instance_id: row.card_instance_id as string,
        expires_at: row.listing_expires_at as string,
        status: row.listing_status as string,
      };
      await this.assertActive(listingLike);

      const buyerId = String(row.buyer_id);
      await this.assertBuyerCapacity(client, buyerId);

      const settled = await this.settleSale(
        client,
        listingLike,
        buyerId,
        Number(row.amount),
        'marketplace_offer_buy',
        'marketplace_offer_sell',
        offerId,
      );
      await client.query(
        `UPDATE marketplace_offers SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [offerId],
      );
      return settled;
    });

    this.notify(
      result.sellerId,
      'success',
      'Offer accepted',
      `You sold ${result.cardName} to an offer for ${result.price} STP`,
    );
    return result;
  }

  async declineOffer(sellerId: string, offerId: string): Promise<{ declined: boolean }> {
    const offer = await this.findOffer(offerId);
    const listing = await this.findListing(String(offer.listing_id));
    if (listing.seller_id !== sellerId) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.status !== 'pending') {
      throw new BadRequestException('Offer is no longer pending');
    }
    await this.db.query(
      `UPDATE marketplace_offers SET status = 'declined', responded_at = NOW() WHERE id = $1`,
      [offerId],
    );
    return { declined: true };
  }

  async cancelOffer(buyerId: string, offerId: string): Promise<{ cancelled: boolean }> {
    const offer = await this.findOffer(offerId);
    if (offer.buyer_id !== buyerId) {
      throw new NotFoundException('Offer not found');
    }
    if (offer.status !== 'pending') {
      throw new BadRequestException('Offer is no longer pending');
    }
    await this.db.query(`UPDATE marketplace_offers SET status = 'cancelled' WHERE id = $1`, [
      offerId,
    ]);
    return { cancelled: true };
  }

  /** Offers I made (outgoing) or received on my listings (incoming). */
  async myOffers(userId: string): Promise<OfferView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT mo.id, mo.listing_id, mo.buyer_id, mo.amount, mo.status, mo.created_at,
              ml.price AS listing_price,
              cd.name AS card_name, cd.key AS card_key,
              u.name AS other_name
       FROM marketplace_offers mo
       JOIN marketplace_listings ml ON ml.id = mo.listing_id
       JOIN card_instances ci ON ci.id = ml.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       JOIN users u ON u.id = CASE WHEN mo.buyer_id = $1 THEN ml.seller_id ELSE mo.buyer_id END
       WHERE mo.buyer_id = $1 OR ml.seller_id = $1
       ORDER BY mo.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return rows.map((r) => this.mapOffer(r, userId));
  }

  // ---------------------------------------------------------------------------
  // Collection & vault (§18)
  // ---------------------------------------------------------------------------

  /** Extended collection: storage location, deck/listing flags, official value. */
  async myCards(userId: string): Promise<CollectionCardView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ci.id, ci.card_key, ci.source, ci.created_at, ci.location,
              cd.name, cd.rarity, cd.category, cd.ability, cd.lore, cd.official_value,
              EXISTS(SELECT 1 FROM deck_cards dc WHERE dc.card_instance_id = ci.id) AS in_deck,
              EXISTS(SELECT 1 FROM marketplace_listings ml
                     WHERE ml.card_instance_id = ci.id AND ml.status = 'active') AS listed
       FROM card_instances ci
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE ci.user_id = $1 AND ci.removed_at IS NULL
       ORDER BY ci.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      cardKey: (r.card_key ?? r.cardKey) as string,
      name: r.name as string,
      rarity: r.rarity as string,
      category: r.category as string,
      ability: r.ability,
      lore: r.lore as string,
      officialValue: Number(r.official_value ?? 0),
      location: (r.location ?? 'inventory') as 'inventory' | 'vault',
      source: r.source as string,
      inDeck: Boolean(r.in_deck ?? r.inDeck),
      listed: Boolean(r.listed),
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
    }));
  }

  /** §18: move a card between inventory and vault (capacity enforced). */
  async moveCard(
    userId: string,
    instanceId: string,
    location: 'inventory' | 'vault',
  ): Promise<{ moved: boolean; location: 'inventory' | 'vault' }> {
    const card = await this.findOwnedCard(userId, instanceId);
    if (card.removed_at) {
      throw new BadRequestException('Card has been removed from circulation');
    }
    const listed = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM marketplace_listings
       WHERE card_instance_id = $1 AND status = 'active'`,
      [instanceId],
    );
    if (listed) {
      throw new BadRequestException('Cancel the marketplace listing before moving this card');
    }
    if (card.location === location) {
      return { moved: false, location };
    }
    await this.assertLocationCapacity(userId, location);
    await this.db.query(`UPDATE card_instances SET location = $1 WHERE id = $2 AND user_id = $3`, [
      location,
      instanceId,
      userId,
    ]);
    return { moved: true, location };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async expireListings(): Promise<number> {
    const result = await this.db.query(
      `UPDATE marketplace_listings SET status = 'expired'
       WHERE status = 'active' AND expires_at < NOW()`,
    );
    return result?.rowCount ?? 0;
  }

  private async assertActive(listing: Record<string, unknown>): Promise<void> {
    if (listing.status !== 'active') {
      throw new BadRequestException('Listing is no longer active');
    }
    if (new Date(listing.expires_at as string) < new Date()) {
      await this.db.query(`UPDATE marketplace_listings SET status = 'expired' WHERE id = $1`, [
        listing.id,
      ]);
      throw new BadRequestException('Listing has expired');
    }
  }

  private async assertSellable(
    userId: string,
    instanceId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT ci.id, ci.user_id, ci.removed_at, cd.name, cd.rarity, cd.official_value, cd.tradable
       FROM card_instances ci
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE ci.id = $1`,
      [instanceId],
    );
    if (!row || row.user_id !== userId) {
      throw new NotFoundException('Card instance not found');
    }
    if (row.removed_at) {
      throw new BadRequestException('Card has been removed from circulation');
    }
    if (!Boolean(row.tradable)) {
      throw new BadRequestException('This card is not tradable');
    }
    const inDeck = await this.db.queryOne<{ deck_id: string }>(
      `SELECT dc.deck_id FROM deck_cards dc WHERE dc.card_instance_id = $1 LIMIT 1`,
      [instanceId],
    );
    if (inDeck) {
      throw new BadRequestException('Remove this card from its deck before listing it');
    }
    return row;
  }

  private async assertBuyerCapacity(
    client: import('pg').PoolClient,
    buyerId: string,
  ): Promise<void> {
    const config = await this.supply.getConfig();
    const owned = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM card_instances
       WHERE user_id = $1 AND removed_at IS NULL AND location = 'inventory'`,
      [buyerId],
    );
    if (Number(owned.rows[0]?.count ?? 0) + 1 > config.inventoryCapacity) {
      throw new BadRequestException(
        'Inventory is full — move cards to the vault before buying more',
      );
    }
  }

  private async assertLocationCapacity(
    userId: string,
    location: 'inventory' | 'vault',
  ): Promise<void> {
    const config = await this.supply.getConfig();
    const capacity = location === 'vault' ? config.vaultCapacity : config.inventoryCapacity;
    const row = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM card_instances
       WHERE user_id = $1 AND removed_at IS NULL AND location = $2`,
      [userId, location],
    );
    if (Number(row?.count ?? 0) + 1 > capacity) {
      throw new BadRequestException(
        `${location === 'vault' ? 'Vault' : 'Inventory'} is full (${capacity} cards)`,
      );
    }
  }

  /**
   * Atomic settlement shared by direct buys and accepted offers: lock buyer
   * wallet, debit, transfer ownership, credit seller, mark listing sold.
   */
  private async settleSale(
    client: import('pg').PoolClient,
    listing: Record<string, unknown>,
    buyerId: string,
    amount: number,
    buyType: string,
    sellType: string,
    offerId?: string,
  ): Promise<SettlementResult> {
    const listingId = listing.id as string;
    const cardName = listing.card_name as string;

    await this.wallet.applyChangeWithClient(client, buyerId, {
      amount: -amount,
      transactionType: buyType,
      reason: `Bought ${cardName}`,
      relatedEntityId: listingId,
      idempotencyKey: `economy:${buyType}:${listingId}${offerId ? `:${offerId}` : ''}`,
    });
    await client.query(
      `UPDATE card_instances SET user_id = $1, location = 'inventory' WHERE id = $2`,
      [buyerId, String(listing.card_instance_id)],
    );
    await this.wallet.applyChangeWithClient(client, listing.seller_id as string, {
      amount,
      transactionType: sellType,
      reason: `Sold ${cardName}`,
      relatedEntityId: listingId,
      idempotencyKey: `economy:${sellType}:${listingId}${offerId ? `:${offerId}` : ''}`,
    });
    await client.query(
      `UPDATE marketplace_listings
       SET status = 'sold', sold_at = NOW(), buyer_id = $1
       WHERE id = $2`,
      [buyerId, listingId],
    );
    await client.query(
      `UPDATE marketplace_offers SET status = 'cancelled'
       WHERE listing_id = $1 AND status = 'pending'`,
      [listingId],
    );
    return {
      listingId,
      cardName,
      price: amount,
      buyerId,
      sellerId: listing.seller_id as string,
    };
  }

  private async getListingView(listingId: string): Promise<ListingView> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT ml.id, ml.price, ml.status, ml.seller_id, ml.created_at, ml.expires_at,
              cd.key AS card_key, cd.name AS card_name, cd.rarity, cd.category, cd.ability,
              cd.lore, cd.official_value,
              u.name AS seller_name, u.username AS seller_username,
              FALSE AS has_my_offer
       FROM marketplace_listings ml
       JOIN card_instances ci ON ci.id = ml.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       JOIN users u ON u.id = ml.seller_id
       WHERE ml.id = $1`,
      [listingId],
    );
    if (!row) throw new NotFoundException('Listing not found');
    return this.mapListing(row);
  }

  private async findListing(listingId: string): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM marketplace_listings WHERE id = $1',
      [listingId],
    );
    if (!row) throw new NotFoundException('Listing not found');
    return row;
  }

  private async findOffer(offerId: string): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM marketplace_offers WHERE id = $1',
      [offerId],
    );
    if (!row) throw new NotFoundException('Offer not found');
    return row;
  }

  private async findOwnedCard(
    userId: string,
    instanceId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, user_id, location, removed_at FROM card_instances WHERE id = $1`,
      [instanceId],
    );
    if (!row || row.user_id !== userId) throw new NotFoundException('Card instance not found');
    return row;
  }

  private async loadOfferView(offerId: string, userId: string): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT mo.id, mo.listing_id, mo.buyer_id, mo.amount, mo.status, mo.created_at,
              ml.price AS listing_price,
              cd.name AS card_name, cd.key AS card_key,
              u.name AS other_name
       FROM marketplace_offers mo
       JOIN marketplace_listings ml ON ml.id = mo.listing_id
       JOIN card_instances ci ON ci.id = ml.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       JOIN users u ON u.id = CASE WHEN mo.buyer_id = $1 THEN ml.seller_id ELSE mo.buyer_id END
       WHERE mo.id = $2`,
      [userId, offerId],
    );
    if (!row) throw new NotFoundException('Offer not found');
    return row;
  }

  private mapListing(r: Record<string, unknown>): ListingView {
    return {
      id: r.id as string,
      cardKey: (r.card_key ?? r.cardKey) as string,
      cardName: (r.card_name ?? r.cardName) as string,
      rarity: r.rarity as string,
      category: r.category as string,
      ability: r.ability,
      lore: (r.lore ?? null) as string | null,
      officialValue: Number(r.official_value ?? r.officialValue ?? 0),
      price: Number(r.price),
      status: r.status as string,
      sellerId: (r.seller_id ?? r.sellerId) as string,
      sellerName: (r.seller_name ?? r.sellerName) as string,
      sellerUsername: (r.seller_username ?? r.sellerUsername ?? null) as string | null,
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
      expiresAt: new Date((r.expires_at ?? r.expiresAt) as string),
      hasMyOffer: Boolean(r.has_my_offer ?? r.hasMyOffer),
    };
  }

  private mapOffer(r: Record<string, unknown>, userId: string): OfferView {
    const buyerId = (r.buyer_id ?? r.buyerId) as string;
    return {
      id: r.id as string,
      listingId: (r.listing_id ?? r.listingId) as string,
      buyerId,
      amount: Number(r.amount),
      status: r.status as string,
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
      direction: buyerId === userId ? 'outgoing' : 'incoming',
      cardName: (r.card_name ?? r.cardName) as string,
      cardKey: (r.card_key ?? r.cardKey) as string,
      listingPrice: Number(r.listing_price ?? r.listingPrice ?? 0),
      otherName: (r.other_name ?? r.otherName) as string,
    };
  }

  private notify(
    userId: string,
    type: 'info' | 'success' | 'warning',
    title: string,
    message: string,
  ): void {
    this.notifications
      .create({ userId, type, title, message, link: '/dashboard/economy' })
      .catch((error: Error) => this.logger.debug(`Notification skipped: ${error.message}`));
  }
}
