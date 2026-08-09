import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { DEFAULT_ECONOMY_CONFIG, EconomyConfig } from './economy-config';
import { WalletService, WalletChangeInput } from '../rpg/wallet.service';

const SELLER = 'seller-1';
const BUYER = 'buyer-1';
const OTHER = 'user-2';
const CARD = 'card-inst-1';
const CARD2 = 'card-inst-2';

interface FakeInstance {
  id: string;
  user_id: string;
  card_key: string;
  location: string;
  removed_at: string | null;
  removed_reason: string | null;
}

interface FakeListing {
  id: string;
  seller_id: string;
  card_instance_id: string;
  price: number;
  status: string;
  created_at: string;
  expires_at: string;
  sold_at: string | null;
  buyer_id: string | null;
}

interface FakeOffer {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount: number;
  status: string;
  created_at: string;
  responded_at: string | null;
}

interface FakeDeckCard {
  deck_id: string;
  card_instance_id: string;
}

/** In-memory fake DatabaseService + transaction client covering EconomyService queries. */
function makeDb() {
  const state: {
    users: Map<string, { name: string; username: string | null }>;
    instances: Map<string, FakeInstance>;
    definitions: Map<string, { key: string; name: string; rarity: string; category: string; ability: unknown; lore: string; official_value: number; tradable: boolean }>;
    listings: Map<string, FakeListing>;
    offers: Map<string, FakeOffer>;
    deckCards: FakeDeckCard[];
    profiles: Map<string, { stp: number }>;
    ledger: Array<{ user_id: string; idempotency_key: string; amount: number; transaction_type: string; balance_before: number; balance_after: number }>;
    configValue: Record<string, unknown> | null;
  } = {
    users: new Map([
      [SELLER, { name: 'Seller', username: 'seller' }],
      [BUYER, { name: 'Buyer', username: 'buyer' }],
      [OTHER, { name: 'Other', username: 'other' }],
    ]),
    instances: new Map([
      [CARD, { id: CARD, user_id: SELLER, card_key: 'mana_slash', location: 'inventory', removed_at: null, removed_reason: null }],
      [CARD2, { id: CARD2, user_id: BUYER, card_key: 'study_burst', location: 'vault', removed_at: null, removed_reason: null }],
    ]),
    definitions: new Map([
      ['mana_slash', { key: 'mana_slash', name: 'Mana Slash', rarity: 'common', category: 'attack', ability: {}, lore: 'A slash of focus.', official_value: 25, tradable: true }],
      ['study_burst', { key: 'study_burst', name: 'Study Burst', rarity: 'common', category: 'attack', ability: {}, lore: 'Burst of study.', official_value: 25, tradable: true }],
    ]),
    listings: new Map(),
    offers: new Map(),
    deckCards: [],
    profiles: new Map([
      [SELLER, { stp: 1000 }],
      [BUYER, { stp: 1000 }],
      [OTHER, { stp: 0 }],
    ]),
    ledger: [],
    configValue: null,
  };

  let listingSeq = 1;
  let offerSeq = 1;

  const applyWallet = async (userId: string, input: WalletChangeInput) => {
    const replay = state.ledger.find((l) => l.user_id === userId && l.idempotency_key === input.idempotencyKey);
    if (replay) return replay;
    const profile = state.profiles.get(userId) ?? { stp: 0 };
    const before = profile.stp;
    const after = before + input.amount;
    if (after < 0) throw new BadRequestException('Insufficient STP/SLC balance');
    profile.stp = after;
    const entry = {
      user_id: userId,
      idempotency_key: input.idempotencyKey,
      amount: input.amount,
      transaction_type: input.transactionType,
      balance_before: before,
      balance_after: after,
    };
    state.ledger.push(entry);
    return entry;
  };

  const listingView = (l: FakeListing) => {
    const inst = state.instances.get(l.card_instance_id);
    const cd = inst ? state.definitions.get(inst.card_key) : undefined;
    const seller = state.users.get(l.seller_id);
    return {
      id: l.id,
      price: l.price,
      status: l.status,
      seller_id: l.seller_id,
      created_at: l.created_at,
      expires_at: l.expires_at,
      card_key: cd?.key,
      card_name: cd?.name,
      rarity: cd?.rarity,
      category: cd?.category,
      ability: cd?.ability,
      lore: cd?.lore,
      official_value: cd?.official_value,
      seller_name: seller?.name,
      seller_username: seller?.username,
      has_my_offer: false,
    };
  };

  const handle = async (text: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount?: number }> => {
    // Config
    if (/SELECT value FROM game_config/.test(text)) {
      return { rows: state.configValue ? [{ value: state.configValue }] : [] };
    }
    // Marketplace list view (join query with card_key AS card_key)
    if (/AS card_key/.test(text) && /marketplace_listings ml/.test(text) && !/FOR UPDATE/.test(text) && !/marketplace_offers/.test(text)) {
      const mine = text.includes('ml.seller_id = $');
      const rows = [...state.listings.values()]
        .filter((l) => l.status === 'active')
        .filter((l) => !mine || l.seller_id === params[0])
        .map((l) => listingView(l));
      return { rows };
    }
    if (/SELECT ml\.\*, cd\.name AS card_name/.test(text) && !/FOR UPDATE/.test(text)) {
      const l = state.listings.get(params[0] as string);
      if (!l) return { rows: [] };
      const inst = state.instances.get(l.card_instance_id);
      return { rows: [{ ...l, card_name: inst ? state.definitions.get(inst.card_key)?.name : undefined, card_key: inst?.card_key }] };
    }
    if (/SELECT \* FROM marketplace_listings WHERE id/.test(text)) {
      const l = state.listings.get(params[0] as string);
      return { rows: l ? [l] : [] };
    }
    if (/INSERT INTO marketplace_listings/.test(text)) {
      const id = params[0] as string;
      state.listings.set(id, {
        id,
        seller_id: params[1] as string,
        card_instance_id: params[2] as string,
        price: Number(params[3]),
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: params[4] as string,
        sold_at: null,
        buyer_id: null,
      });
      return { rows: [] };
    }
    if (/UPDATE marketplace_listings SET status = 'expired'/.test(text)) {
      for (const l of state.listings.values()) {
        if (l.status === 'active' && new Date(l.expires_at) < new Date()) l.status = 'expired';
      }
      return { rows: [], rowCount: 0 };
    }
    if (/UPDATE marketplace_listings SET status = 'cancelled'/.test(text)) {
      const l = state.listings.get(params[0] as string);
      if (l) l.status = 'cancelled';
      return { rows: [] };
    }
    if (/UPDATE marketplace_listings\s+SET status = 'sold'/.test(text)) {
      const l = state.listings.get(params[1] as string);
      if (l) {
        l.status = 'sold';
        l.sold_at = new Date().toISOString();
        l.buyer_id = params[0] as string;
      }
      return { rows: [] };
    }
    // Offers
    if (/INSERT INTO marketplace_offers/.test(text)) {
      const id = params[0] as string;
      state.offers.set(id, {
        id,
        listing_id: params[1] as string,
        buyer_id: params[2] as string,
        amount: Number(params[3]),
        status: 'pending',
        created_at: new Date().toISOString(),
        responded_at: null,
      });
      return { rows: [] };
    }
    if (/UPDATE marketplace_offers SET status = 'cancelled'/.test(text)) {
      for (const o of state.offers.values()) {
        if (o.listing_id === params[0] && o.status === 'pending') o.status = 'cancelled';
      }
      return { rows: [] };
    }
    if (/UPDATE marketplace_offers SET status = 'accepted'/.test(text)) {
      const o = state.offers.get(params[0] as string);
      if (o) {
        o.status = 'accepted';
        o.responded_at = new Date().toISOString();
      }
      return { rows: [] };
    }
    if (/UPDATE marketplace_offers SET status = 'declined'/.test(text)) {
      const o = state.offers.get(params[0] as string);
      if (o) {
        o.status = 'declined';
        o.responded_at = new Date().toISOString();
      }
      return { rows: [] };
    }
    if (/FOR UPDATE OF mo/.test(text)) {
      const o = state.offers.get(params[0] as string);
      if (!o) return { rows: [] };
      const l = state.listings.get(o.listing_id);
      const inst = l ? state.instances.get(l.card_instance_id) : undefined;
      const cd = inst ? state.definitions.get(inst.card_key) : undefined;
      return {
        rows: [
          {
            ...o,
            listing_seller: l?.seller_id,
            listing_status: l?.status,
            listing_expires_at: l?.expires_at,
            card_instance_id: l?.card_instance_id,
            card_name: cd?.name,
            card_key: cd?.key,
          },
        ],
      };
    }
    if (/SELECT \* FROM marketplace_offers WHERE id/.test(text)) {
      const o = state.offers.get(params[0] as string);
      return { rows: o ? [o] : [] };
    }
    if (/WHERE mo\.id = \$2/.test(text)) {
      const o = state.offers.get(params[1] as string);
      if (!o) return { rows: [] };
      const l = state.listings.get(o.listing_id);
      const inst = l ? state.instances.get(l.card_instance_id) : undefined;
      const cd = inst ? state.definitions.get(inst.card_key) : undefined;
      const otherId = o.buyer_id === params[0] ? l?.seller_id : o.buyer_id;
      return {
        rows: [
          {
            id: o.id,
            listing_id: o.listing_id,
            buyer_id: o.buyer_id,
            amount: o.amount,
            status: o.status,
            created_at: o.created_at,
            listing_price: l?.price,
            card_name: cd?.name,
            card_key: cd?.key,
            other_name: state.users.get(otherId ?? '')?.name,
          },
        ],
      };
    }
    if (/marketplace_offers mo/.test(text) && !/FOR UPDATE/.test(text)) {
      const rows: unknown[] = [];
      for (const o of state.offers.values()) {
        const l = state.listings.get(o.listing_id);
        if (!l) continue;
        const isMineAsBuyer = o.buyer_id === params[0];
        const isMineAsSeller = l.seller_id === params[0];
        if (!isMineAsBuyer && !isMineAsSeller) continue;
        const inst = state.instances.get(l.card_instance_id);
        const cd = inst ? state.definitions.get(inst.card_key) : undefined;
        const otherId = isMineAsBuyer ? l.seller_id : o.buyer_id;
        rows.push({
          id: o.id,
          listing_id: o.listing_id,
          buyer_id: o.buyer_id,
          amount: o.amount,
          status: o.status,
          created_at: o.created_at,
          listing_price: l.price,
          card_name: cd?.name,
          card_key: cd?.key,
          other_name: state.users.get(otherId)?.name,
        });
      }
      return { rows };
    }
    // Offer accept lock (FOR UPDATE OF mo) — must precede the generic listing
    // lock below, since the accept query also references marketplace_listings ml.
    if (/FOR UPDATE OF mo/.test(text)) {
      const o = state.offers.get(params[0] as string);
      if (!o) return { rows: [] };
      const l = state.listings.get(o.listing_id);
      return {
        rows: [
          {
            ...o,
            listing_id: o.listing_id,
            listing_seller: l?.seller_id,
            listing_status: l?.status,
            listing_expires_at: l?.expires_at,
            card_instance_id: l?.card_instance_id,
            card_name: l ? state.definitions.get(state.instances.get(l.card_instance_id)?.card_key ?? '')?.name : undefined,
            card_key: l ? state.instances.get(l.card_instance_id)?.card_key : undefined,
          },
        ],
      };
    }
    // Listing lock for buy (FOR UPDATE)
    if (/FOR UPDATE/.test(text) && /marketplace_listings ml/.test(text)) {
      const l = state.listings.get(params[0] as string);
      if (!l) return { rows: [] };
      const inst = state.instances.get(l.card_instance_id);
      return { rows: [{ ...l, card_name: inst ? state.definitions.get(inst.card_key)?.name : undefined }] };
    }
    // Capacity / counts
    if (/COUNT\(\*\)::int AS count FROM card_instances/.test(text)) {
      const userId = params[0] as string;
      const locationParam = text.includes('location = $2') ? (params[1] as string) : 'inventory';
      const count = [...state.instances.values()].filter(
        (i) => i.user_id === userId && i.removed_at === null && i.location === locationParam,
      ).length;
      return { rows: [{ count }] };
    }
    if (/SELECT id, removed_at FROM card_instances WHERE id/.test(text)) {
      const inst = state.instances.get(params[0] as string);
      return { rows: inst ? [{ id: inst.id, removed_at: inst.removed_at }] : [] };
    }
    if (/UPDATE card_instances SET user_id/.test(text)) {
      const inst = state.instances.get(params[1] as string);
      if (inst) {
        inst.user_id = params[0] as string;
        inst.location = 'inventory';
      }
      return { rows: [] };
    }
    if (/UPDATE card_instances SET location/.test(text)) {
      const inst = state.instances.get(params[1] as string);
      if (inst) inst.location = params[0] as string;
      return { rows: [] };
    }
    if (/SELECT id, user_id, location, removed_at FROM card_instances WHERE id/.test(text)) {
      const inst = state.instances.get(params[0] as string);
      return { rows: inst ? [{ id: inst.id, user_id: inst.user_id, location: inst.location, removed_at: inst.removed_at }] : [] };
    }
    if (/SELECT id FROM marketplace_listings\n\s+WHERE card_instance_id/.test(text)) {
      const listed = [...state.listings.values()].find(
        (l) => l.card_instance_id === params[0] && l.status === 'active',
      );
      return { rows: listed ? [{ id: listed.id }] : [] };
    }
    if (/SELECT dc\.deck_id FROM deck_cards dc WHERE dc\.card_instance_id/.test(text)) {
      const dc = state.deckCards.find((d) => d.card_instance_id === params[0]);
      return { rows: dc ? [{ deck_id: dc.deck_id }] : [] };
    }
    // Extended collection
    if (/EXISTS\(SELECT 1 FROM deck_cards/.test(text)) {
      const rows = [...state.instances.values()]
        .filter((i) => i.user_id === params[0] && i.removed_at === null)
        .map((i) => {
          const cd = state.definitions.get(i.card_key);
          const inDeck = state.deckCards.some((d) => d.card_instance_id === i.id);
          const listed = [...state.listings.values()].some(
            (l) => l.card_instance_id === i.id && l.status === 'active',
          );
          return {
            id: i.id,
            card_key: i.card_key,
            source: 'starter',
            created_at: '2026-01-01T00:00:00Z',
            location: i.location,
            name: cd?.name,
            rarity: cd?.rarity,
            category: cd?.category,
            ability: cd?.ability,
            lore: cd?.lore,
            official_value: cd?.official_value,
            in_deck: inDeck,
            listed,
          };
        });
      return { rows };
    }
    // Generic card instance + definition join (sellable / removable checks)
    if (/FROM card_instances ci\n\s+JOIN card_definitions cd/.test(text)) {
      const inst = state.instances.get(params[0] as string);
      if (!inst) return { rows: [] };
      const cd = state.definitions.get(inst.card_key);
      return {
        rows: [
          {
            id: inst.id,
            user_id: inst.user_id,
            card_key: inst.card_key,
            removed_at: inst.removed_at,
            name: cd?.name,
            rarity: cd?.rarity,
            official_value: cd?.official_value,
            tradable: cd?.tradable,
            burnable: true,
            scrapable: true,
          },
        ],
      };
    }
    // Wallet (via mocked WalletService below, but keep profile rows for reads)
    if (/SELECT stp FROM player_profiles/.test(text)) {
      return { rows: [{ stp: state.profiles.get(params[0] as string)?.stp ?? 0 }] };
    }
    if (/INSERT INTO player_profiles/.test(text)) {
      if (!state.profiles.has(params[0] as string)) state.profiles.set(params[0] as string, { stp: 0 });
      return { rows: [] };
    }
    return { rows: [] };
  };

  const client = { query: handle };
  const db = {
    query: handle,
    queryOne: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows[0],
    queryMany: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows,
    transaction: async <T>(fn: (c: { query: typeof handle }) => Promise<T>): Promise<T> => fn(client),
  };

  const wallet = {
    applyChange: jest.fn(),
    applyChangeWithClient: jest.fn(
      async (_client: unknown, userId: string, input: WalletChangeInput) => applyWallet(userId, input),
    ),
  } as unknown as WalletService;

  const notifications = {
    create: jest.fn().mockResolvedValue({}),
  };

  const supply = {
    getConfig: jest.fn().mockResolvedValue(DEFAULT_ECONOMY_CONFIG),
    checkExtinction: jest.fn().mockResolvedValue({ extinct: false }),
  };

  return { db, wallet, notifications, supply, state };
}

describe('EconomyService', () => {
  let fixture: ReturnType<typeof makeDb>;
  let service: EconomyService;

  beforeEach(() => {
    fixture = makeDb();
    service = new EconomyService(
      fixture.db as never,
      fixture.wallet,
      fixture.notifications as never,
      fixture.supply as never,
    );
  });

  describe('listCard', () => {
    it('lists an owned, deck-free card at a fixed price', async () => {
      const result = await service.listCard(SELLER, { cardInstanceId: CARD, price: 50 });
      expect(result).toMatchObject({ cardName: 'Mana Slash', price: 50, status: 'active' });
      expect(fixture.state.listings.size).toBe(1);
      const listing = [...fixture.state.listings.values()][0];
      expect(listing.seller_id).toBe(SELLER);
      expect(new Date(listing.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects an unowned card', async () => {
      await expect(service.listCard(OTHER, { cardInstanceId: CARD, price: 50 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a card that is equipped in a deck', async () => {
      fixture.state.deckCards.push({ deck_id: 'd1', card_instance_id: CARD });
      await expect(service.listCard(SELLER, { cardInstanceId: CARD, price: 50 })).rejects.toThrow(
        'Remove this card from its deck',
      );
    });

    it('rejects duplicate active listings and invalid prices', async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 50 });
      await expect(service.listCard(SELLER, { cardInstanceId: CARD, price: 60 })).rejects.toThrow(
        'already listed',
      );
      await expect(service.listCard(OTHER, { cardInstanceId: CARD2, price: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelListing', () => {
    it('cancels an active listing and its pending offers', async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 50 });
      const listingId = [...fixture.state.listings.keys()][0];
      await service.makeOffer(BUYER, listingId, 40);
      await expect(service.cancelListing(SELLER, listingId)).resolves.toEqual({ cancelled: true });
      expect(fixture.state.listings.get(listingId)?.status).toBe('cancelled');
      expect(fixture.state.offers.size).toBe(1);
    });

    it('cannot cancel someone else’s listing', async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 50 });
      const listingId = [...fixture.state.listings.keys()][0];
      await expect(service.cancelListing(BUYER, listingId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('buyListing', () => {
    beforeEach(async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 100 });
    });

    it('atomically transfers the card, debits buyer and credits seller', async () => {
      const result = await service.buyListing(BUYER, [...fixture.state.listings.keys()][0]);
      expect(result).toMatchObject({ price: 100, buyerId: BUYER, sellerId: SELLER });

      expect(fixture.state.instances.get(CARD)?.user_id).toBe(BUYER);
      expect(fixture.state.profiles.get(BUYER)?.stp).toBe(900);
      expect(fixture.state.profiles.get(SELLER)?.stp).toBe(1100);
      expect(fixture.state.listings.get([...fixture.state.listings.keys()][0])?.status).toBe('sold');
      expect(fixture.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: SELLER, type: 'success' }),
      );
    });

    it('rejects buying your own listing', async () => {
      await expect(service.buyListing(SELLER, [...fixture.state.listings.keys()][0])).rejects.toThrow(
        'own listing',
      );
    });

    it('rejects a sold listing', async () => {
      const listingId = [...fixture.state.listings.keys()][0];
      await service.buyListing(BUYER, listingId);
      await expect(service.buyListing(OTHER, listingId)).rejects.toThrow('no longer active');
    });

    it('rejects a buyer without enough STP', async () => {
      fixture.state.profiles.set(BUYER, { stp: 10 });
      await expect(service.buyListing(BUYER, [...fixture.state.listings.keys()][0])).rejects.toThrow(
        'Insufficient STP/SLC balance',
      );
    });

    it('rejects when the buyer inventory is full', async () => {
      fixture.supply.getConfig.mockResolvedValue({ ...DEFAULT_ECONOMY_CONFIG, inventoryCapacity: 1 });
      fixture.state.instances.set('c3', {
        id: 'c3',
        user_id: BUYER,
        card_key: 'study_burst',
        location: 'inventory',
        removed_at: null,
        removed_reason: null,
      });
      await expect(service.buyListing(BUYER, [...fixture.state.listings.keys()][0])).rejects.toThrow(
        'Inventory is full',
      );
    });

    it('is idempotent — replaying the buy does not double-pay', async () => {
      const listingId = [...fixture.state.listings.keys()][0];
      const first = await service.buyListing(BUYER, listingId);
      expect(first.price).toBe(100);
      const buyerAfter = fixture.state.profiles.get(BUYER)?.stp;
      await expect(service.buyListing(BUYER, listingId)).rejects.toThrow('no longer active');
      expect(fixture.state.profiles.get(BUYER)?.stp).toBe(buyerAfter);
      expect(fixture.state.profiles.get(SELLER)?.stp).toBe(1100);
    });
  });

  describe('offers', () => {
    it('makes, accepts and settles an offer at the offered price', async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 100 });
      const listingId = [...fixture.state.listings.keys()][0];

      const offer = await service.makeOffer(BUYER, listingId, 80);
      expect(offer).toMatchObject({ amount: 80, status: 'pending', direction: 'outgoing', cardName: 'Mana Slash' });

      const result = await service.acceptOffer(SELLER, offer.id);
      expect(result.price).toBe(80);
      expect(fixture.state.instances.get(CARD)?.user_id).toBe(BUYER);
      expect(fixture.state.profiles.get(BUYER)?.stp).toBe(920);
      expect(fixture.state.profiles.get(SELLER)?.stp).toBe(1080);
    });

    it('declines and cancels offers', async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 100 });
      const listingId = [...fixture.state.listings.keys()][0];
      const offer = await service.makeOffer(BUYER, listingId, 80);
      await expect(service.declineOffer(SELLER, offer.id)).resolves.toEqual({ declined: true });
      const offer2 = await service.makeOffer(BUYER, listingId, 70);
      await expect(service.cancelOffer(BUYER, offer2.id)).resolves.toEqual({ cancelled: true });
    });

    it('only the listing seller can accept offers', async () => {
      await service.listCard(SELLER, { cardInstanceId: CARD, price: 100 });
      const listingId = [...fixture.state.listings.keys()][0];
      const offer = await service.makeOffer(BUYER, listingId, 80);
      await expect(service.acceptOffer(OTHER, offer.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('vault & collection', () => {
    it('moves a card between inventory and vault', async () => {
      await expect(service.moveCard(BUYER, CARD2, 'inventory')).resolves.toEqual({
        moved: true,
        location: 'inventory',
      });
      expect(fixture.state.instances.get(CARD2)?.location).toBe('inventory');
    });

    it('enforces vault capacity', async () => {
      fixture.supply.getConfig.mockResolvedValue({ ...DEFAULT_ECONOMY_CONFIG, vaultCapacity: 1 });
      fixture.state.instances.set('c3', { id: 'c3', user_id: SELLER, card_key: 'mana_slash', location: 'vault', removed_at: null, removed_reason: null });
      await expect(service.moveCard(SELLER, CARD, 'vault')).rejects.toThrow('Vault is full');
    });

    it('returns the extended collection with deck/listing flags', async () => {
      fixture.state.deckCards.push({ deck_id: 'd1', card_instance_id: CARD2 });
      const cards = await service.myCards(BUYER);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ cardKey: 'study_burst', inDeck: true, listed: false });
    });
  });
});
