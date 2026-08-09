import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { economyService } from '@/services/economy';
import {
  Loader2,
  Store,
  Wallet,
  Boxes,
  Flame,
  Scissors,
  ArrowLeftRight,
  Tag,
  Coins,
  TrendingUp,
  History,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldAlert,
  Gavel,
  RefreshCw,
  PackageOpen,
  Ban,
} from 'lucide-react';
import type {
  EconomyBurnStatus,
  EconomyCollectionCard,
  EconomyListing,
  EconomyOffer,
  EconomySupplyRow,
} from '@/types';

type Tab = 'marketplace' | 'collection' | 'supply';

const rarityStyles: Record<string, string> = {
  common: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
  rare: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  legendary: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200',
};

const rarityHeader: Record<string, string> = {
  common: 'from-slate-500/10 to-slate-500/0',
  rare: 'from-sky-500/15 to-sky-500/0',
  legendary: 'from-amber-500/20 to-amber-500/0',
};

const locationStyles: Record<string, string> = {
  inventory: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  vault: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

export default function EconomyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('marketplace');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Marketplace
  const [listings, setListings] = useState<EconomyListing[]>([]);
  const [offers, setOffers] = useState<EconomyOffer[]>([]);
  const [rarityFilter, setRarityFilter] = useState<'all' | 'common' | 'rare' | 'legendary'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [offerAmounts, setOfferAmounts] = useState<Record<string, string>>({});
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  // Collection
  const [cards, setCards] = useState<EconomyCollectionCard[]>([]);
  const [sellPrices, setSellPrices] = useState<Record<string, string>>({});
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeKind, setRemoveKind] = useState<'scrape' | 'burn' | null>(null);
  const [burnStatuses, setBurnStatuses] = useState<Record<string, EconomyBurnStatus>>({});

  // Supply
  const [supply, setSupply] = useState<EconomySupplyRow[]>([]);
  const [history, setHistory] = useState<Record<string, Array<{ value: number; reason: string; created_at: string }>>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const flashError = useCallback((err: unknown) => {
    const message =
      err && typeof err === 'object' && 'response' in err
        ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
        : '';
    setError(message || t('economy.error'));
  }, [t]);

  const refreshMarketplace = useCallback(async (params?: { rarity?: string; mine?: boolean }) => {
    const data = await economyService.marketplace(params);
    setListings(data);
  }, []);

  const refreshOffers = useCallback(async () => {
    const data = await economyService.myOffers();
    setOffers(data);
  }, []);

  const refreshCards = useCallback(async () => {
    const data = await economyService.myCards();
    setCards(data);
    const statuses: Record<string, EconomyBurnStatus> = {};
    await Promise.all(
      data.map(async (card) => {
        try {
          statuses[card.id] = await economyService.burnStatus(card.id);
        } catch {
          // no active burn for this card — fine
        }
      }),
    );
    setBurnStatuses(statuses);
  }, []);

  const refreshSupply = useCallback(async () => {
    const data = await economyService.supplyReport();
    setSupply(data);
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([refreshMarketplace(), refreshOffers(), refreshCards(), refreshSupply()]);
    } catch (err) {
      flashError(err);
    } finally {
      setIsLoading(false);
    }
  }, [flashError, refreshCards, refreshMarketplace, refreshOffers, refreshSupply]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (rarityFilter !== 'all' && l.rarity !== rarityFilter) return false;
      if (mineOnly && l.sellerId !== user?.id) return false;
      return true;
    });
  }, [listings, rarityFilter, mineOnly, user?.id]);

  const pendingOffers = useMemo(() => offers.filter((o) => o.status === 'pending'), [offers]);

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: listings.length };
    for (const l of listings) counts[l.rarity] = (counts[l.rarity] ?? 0) + 1;
    return counts;
  }, [listings]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleBuy = async (listingId: string) => {
    setBuyingId(listingId);
    setError(null);
    try {
      const result = await economyService.buyListing(listingId);
      showNotice(`${result.cardName} → ${result.price.toLocaleString()} STP`);
      await Promise.all([refreshMarketplace(), refreshOffers(), refreshCards()]);
    } catch (err) {
      flashError(err);
    } finally {
      setBuyingId(null);
    }
  };

  const handleMakeOffer = async (listingId: string) => {
    const amount = Number(offerAmounts[listingId]);
    if (!Number.isInteger(amount) || amount <= 0) return;
    setOfferingId(listingId);
    setError(null);
    try {
      await economyService.makeOffer(listingId, amount);
      showNotice(t('economy.offerMade'));
      setOfferAmounts((prev) => ({ ...prev, [listingId]: '' }));
      await Promise.all([refreshMarketplace(), refreshOffers()]);
    } catch (err) {
      flashError(err);
    } finally {
      setOfferingId(null);
    }
  };

  const handleOfferAction = async (offerId: string, action: 'accept' | 'decline' | 'cancel') => {
    setError(null);
    try {
      if (action === 'accept') await economyService.acceptOffer(offerId);
      if (action === 'decline') await economyService.declineOffer(offerId);
      if (action === 'cancel') await economyService.cancelOffer(offerId);
      await Promise.all([refreshMarketplace(), refreshOffers(), refreshCards()]);
    } catch (err) {
      flashError(err);
    }
  };

  const handleListCard = async (cardId: string) => {
    const price = Number(sellPrices[cardId]);
    if (!Number.isInteger(price) || price <= 0) return;
    setSellingId(cardId);
    setError(null);
    try {
      await economyService.listCard(cardId, price);
      showNotice(t('economy.listed'));
      setSellPrices((prev) => ({ ...prev, [cardId]: '' }));
      await Promise.all([refreshMarketplace(), refreshCards()]);
    } catch (err) {
      flashError(err);
    } finally {
      setSellingId(null);
    }
  };

  const handleMove = async (cardId: string, location: 'inventory' | 'vault') => {
    setMovingId(cardId);
    setError(null);
    try {
      await economyService.moveCard(cardId, location);
      await refreshCards();
    } catch (err) {
      flashError(err);
    } finally {
      setMovingId(null);
    }
  };

  const handleRemove = async (cardId: string) => {
    if (!removeKind) return;
    setRemovingId(cardId);
    setError(null);
    try {
      if (removeKind === 'scrape') {
        const result = await economyService.scrapeCard(cardId);
        showNotice(`${result.name}: +${result.payout.toLocaleString()} STP`);
      } else {
        const result = await economyService.burnCard(cardId);
        showNotice(
          `${result.name}: ${result.firstPayment.toLocaleString()} STP now, ${result.instalments} instalments`,
        );
      }
      setRemoveKind(null);
      await Promise.all([refreshCards(), refreshSupply()]);
    } catch (err) {
      flashError(err);
    } finally {
      setRemovingId(null);
    }
  };

  const toggleHistory = async (cardKey: string) => {
    if (expandedKey === cardKey) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(cardKey);
    try {
      const data = await economyService.priceHistory(cardKey);
      setHistory((prev) => ({ ...prev, [cardKey]: data }));
    } catch {
      // history unavailable — leave empty
    }
  };

  const handleAdmin = async (action: 'reconcile' | 'instalments') => {
    setAdminBusy(true);
    setError(null);
    try {
      if (action === 'reconcile') {
        const result = await economyService.reconcile();
        showNotice(
          `${result.cardsChecked} cards checked, ${result.valueChanges} value changes${result.extinct.length ? `, ${result.extinct.length} extinct` : ''}`,
        );
        await refreshSupply();
      } else {
        const result = await economyService.processBurnInstalments();
        showNotice(`${result.processed} instalment runs, ${result.completed} completed`);
      }
    } catch (err) {
      flashError(err);
    } finally {
      setAdminBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const rarityBadge = (rarity: string) => (
    <Badge className={cn('border', rarityStyles[rarity] ?? rarityStyles.common)}>{t(`economy.rarity.${rarity}`)}</Badge>
  );

  const renderListingCard = (listing: EconomyListing) => (
    <Card
      key={listing.id}
      className={cn(
        'overflow-hidden border transition-shadow hover:shadow-md dark:hover:shadow-slate-900/40',
        rarityStyles[listing.rarity] ?? rarityStyles.common,
      )}
    >
      <div className={cn('h-1.5 w-full bg-gradient-to-r', rarityHeader[listing.rarity] ?? rarityHeader.common)} />
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold leading-tight">{listing.cardName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{listing.category}</p>
          </div>
          {rarityBadge(listing.rarity)}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('economy.officialValue')}
          </span>
          <span className="font-medium tabular-nums">{listing.officialValue.toLocaleString()} STP</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold tabular-nums text-foreground flex items-center gap-1">
              <Coins className="h-4 w-4 text-amber-500" />
              {listing.price.toLocaleString()}
              <span className="text-xs font-medium text-muted-foreground">STP</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('economy.seller')}: {listing.sellerName}
            </p>
          </div>
        </div>

        {offeringId === listing.id ? (
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              placeholder={t('economy.offerPlaceholder')}
              value={offerAmounts[listing.id] ?? ''}
              onChange={(e) => setOfferAmounts((prev) => ({ ...prev, [listing.id]: e.target.value }))}
            />
            <Button size="sm" onClick={() => handleMakeOffer(listing.id)}>
              {t('economy.sendOffer')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOfferingId(null)}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={buyingId === listing.id}
              onClick={() => handleBuy(listing.id)}
            >
              {buyingId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              {t('economy.buy')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOfferingId(listing.id)}>
              <Gavel className="h-4 w-4" />
              {t('economy.offer')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderCollectionCard = (card: EconomyCollectionCard) => {
    const burn = burnStatuses[card.id];
    const canMove = !card.inDeck && !card.listed;
    return (
      <Card
        key={card.id}
        className={cn(
          'overflow-hidden border transition-shadow hover:shadow-md dark:hover:shadow-slate-900/40',
          rarityStyles[card.rarity] ?? rarityStyles.common,
        )}
      >
        <div className={cn('h-1.5 w-full bg-gradient-to-r', rarityHeader[card.rarity] ?? rarityHeader.common)} />
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{card.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground capitalize">{card.category}</p>
            </div>
            {rarityBadge(card.rarity)}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge className={cn('border', locationStyles[card.location])}>
              {t(`economy.location.${card.location}`)}
            </Badge>
            {card.inDeck && (
              <Badge variant="outline" className="border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-300">
                {t('economy.inDeck')}
              </Badge>
            )}
            {card.listed && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
                {t('economy.listedBadge')}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('economy.officialValue')}
            </span>
            <span className="font-medium tabular-nums">{card.officialValue.toLocaleString()} STP</span>
          </div>

          {burn && burn.status === 'active' && (
            <div className="rounded-lg border border-orange-300/60 bg-orange-50 p-2 text-xs text-orange-700 dark:border-orange-700/50 dark:bg-orange-900/20 dark:text-orange-300">
              <p className="flex items-center gap-1 font-medium">
                <Flame className="h-3.5 w-3.5" />
                {t('economy.burnActive')}
              </p>
              <p className="mt-1 tabular-nums">
                {burn.paidAmount.toLocaleString()} / {burn.total.toLocaleString()} STP · {burn.paidCount}/{burn.instalments}{' '}
                {t('economy.instalments')}
              </p>
              {burn.nextInstalmentAt && (
                <p className="mt-0.5 text-muted-foreground">
                  {t('economy.nextInstalment')}: {new Date(burn.nextInstalmentAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {sellingId === card.id ? (
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                placeholder={t('economy.pricePlaceholder')}
                value={sellPrices[card.id] ?? ''}
                onChange={(e) => setSellPrices((prev) => ({ ...prev, [card.id]: e.target.value }))}
              />
              <Button size="sm" onClick={() => handleListCard(card.id)}>
                {t('economy.confirmList')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSellingId(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canMove && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={movingId === card.id}
                  onClick={() => handleMove(card.id, card.location === 'inventory' ? 'vault' : 'inventory')}
                >
                  {movingId === card.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="h-4 w-4" />
                  )}
                  {t(card.location === 'inventory' ? 'economy.toVault' : 'economy.toInventory')}
                </Button>
              )}
              {!card.listed && (
                <Button size="sm" variant="outline" onClick={() => setSellingId(card.id)}>
                  <Tag className="h-4 w-4" />
                  {t('economy.sell')}
                </Button>
              )}

              <div className="ml-auto flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      onClick={() => setRemoveKind('scrape')}
                    >
                      <Scissors className="h-4 w-4" />
                      {t('economy.scrape')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('economy.scrapeTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('economy.scrapeWarning')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRemoveKind(null)}>{t('economy.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-slate-700 text-white hover:bg-slate-800"
                        disabled={removingId === card.id}
                        onClick={(e) => {
                          e.preventDefault();
                          void handleRemove(card.id);
                        }}
                      >
                        {removingId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                        {t('economy.confirmScrape')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-600 hover:text-orange-700 dark:text-orange-400"
                      onClick={() => setRemoveKind('burn')}
                    >
                      <Flame className="h-4 w-4" />
                      {t('economy.burn')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('economy.burnTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('economy.burnWarning')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRemoveKind(null)}>{t('economy.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-orange-600 text-white hover:bg-orange-700"
                        disabled={removingId === card.id}
                        onClick={(e) => {
                          e.preventDefault();
                          void handleRemove(card.id);
                        }}
                      >
                        {removingId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                        {t('economy.confirmBurn')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Store }> = [
    { key: 'marketplace', label: t('economy.tab.marketplace'), icon: Store },
    { key: 'collection', label: t('economy.tab.collection'), icon: Wallet },
    { key: 'supply', label: t('economy.tab.supply'), icon: Boxes },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" />
            {t('economy.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('economy.subtitle')}</p>
        </div>

        {/* Notice + error banners */}
        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {notice}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-300/60 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300"
            >
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm w-fit">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('economy.loading')}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'marketplace' && (
              <motion.div
                key="marketplace"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                {/* Offers strip */}
                {pendingOffers.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Gavel className="h-4 w-4" />
                        {t('economy.pendingOffers')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {pendingOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{offer.cardName}</span>
                            <Badge variant="secondary" className="tabular-nums">
                              {offer.amount.toLocaleString()} STP
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {offer.direction === 'incoming'
                                ? `${t('economy.from')} ${offer.otherName}`
                                : `${t('economy.to')} ${offer.otherName}`}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {offer.direction === 'incoming' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleOfferAction(offer.id, 'accept')}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  {t('economy.accept')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOfferAction(offer.id, 'decline')}
                                >
                                  <XCircle className="h-4 w-4" />
                                  {t('economy.decline')}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOfferAction(offer.id, 'cancel')}
                              >
                                <Ban className="h-4 w-4" />
                                {t('economy.cancelOffer')}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {(['all', 'common', 'rare', 'legendary'] as const).map((rarity) => (
                    <button
                      key={rarity}
                      onClick={() => setRarityFilter(rarity)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        rarityFilter === rarity
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                      )}
                    >
                      {t(`economy.rarity.${rarity}`)}
                      <span className="ml-1 tabular-nums opacity-70">({rarityCounts[rarity] ?? 0})</span>
                    </button>
                  ))}
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant={mineOnly ? 'default' : 'outline'}
                      onClick={() => setMineOnly((prev) => !prev)}
                    >
                      <Tag className="h-4 w-4" />
                      {t('economy.myListings')}
                    </Button>
                  </div>
                </div>

                {/* Listings grid */}
                {filteredListings.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
                    <PackageOpen className="h-8 w-8 opacity-50" />
                    <p className="text-sm">{t('economy.noListings')}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredListings.map(renderListingCard)}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'collection' && (
              <motion.div
                key="collection"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap gap-3 text-sm">
                  <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    {t('economy.owned')}: <span className="font-semibold tabular-nums">{cards.length}</span>
                  </Badge>
                  <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                    <PackageOpen className="h-3.5 w-3.5" />
                    {t('economy.location.inventory')}:{' '}
                    <span className="font-semibold tabular-nums">{cards.filter((c) => c.location === 'inventory').length}</span>
                  </Badge>
                  <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                    <Boxes className="h-3.5 w-3.5" />
                    {t('economy.location.vault')}:{' '}
                    <span className="font-semibold tabular-nums">{cards.filter((c) => c.location === 'vault').length}</span>
                  </Badge>
                  <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {t('economy.listedBadge')}:{' '}
                    <span className="font-semibold tabular-nums">{cards.filter((c) => c.listed).length}</span>
                  </Badge>
                </div>

                {cards.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
                    <PackageOpen className="h-8 w-8 opacity-50" />
                    <p className="text-sm">{t('economy.noCards')}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map(renderCollectionCard)}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'supply' && (
              <motion.div
                key="supply"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    {t('economy.supplyHint')}
                  </p>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={adminBusy} onClick={() => handleAdmin('reconcile')}>
                        {adminBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {t('economy.adminReconcile')}
                      </Button>
                      <Button size="sm" variant="outline" disabled={adminBusy} onClick={() => handleAdmin('instalments')}>
                        {adminBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                        {t('economy.adminInstalments')}
                      </Button>
                    </div>
                  )}
                </div>

                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3 font-medium">{t('economy.card')}</th>
                          <th className="px-4 py-3 font-medium">{t('economy.rarity.supply')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('economy.original')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('economy.active')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('economy.burned')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('economy.scraped')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('economy.listedShort')}</th>
                          <th className="px-4 py-3 text-right font-medium">{t('economy.officialValue')}</th>
                          <th className="px-4 py-3 font-medium">{t('economy.statusCol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supply.map((row) => (
                          <>
                            <tr key={row.key} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="px-4 py-2.5">
                                <button
                                  className="flex items-center gap-1.5 font-medium hover:text-foreground/70"
                                  onClick={() => toggleHistory(row.key)}
                                >
                                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                                  {row.name}
                                </button>
                              </td>
                              <td className="px-4 py-2.5">{rarityBadge(row.rarity)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.originalSupply}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.activeSupply}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.burnedCount}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.scrapedCount}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{row.listedCount}</td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums">{row.officialValue.toLocaleString()}</td>
                              <td className="px-4 py-2.5">
                                {row.extinct ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <Flame className="h-3 w-3" />
                                    {t('economy.extinct')}
                                  </Badge>
                                ) : row.replacementOf ? (
                                  <Badge variant="outline" className="gap-1 border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-300">
                                    <Sparkles className="h-3 w-3" />
                                    {t('economy.replacement')}
                                  </Badge>
                                ) : row.active ? (
                                  <Badge variant="outline" className="border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
                                    {t('economy.activeBadge')}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">{t('economy.retired')}</Badge>
                                )}
                              </td>
                            </tr>
                            {expandedKey === row.key && (
                              <tr key={`${row.key}-history`} className="border-b bg-muted/30">
                                <td colSpan={9} className="px-4 py-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      {t('economy.priceHistory')}
                                    </p>
                                    {!history[row.key] || history[row.key].length === 0 ? (
                                      <p className="text-xs text-muted-foreground">{t('economy.noHistory')}</p>
                                    ) : (
                                      history[row.key]
                                        .slice()
                                        .reverse()
                                        .map((point, idx) => (
                                          <div
                                            key={`${row.key}-${idx}`}
                                            className="flex items-center justify-between text-xs"
                                          >
                                            <span className="text-muted-foreground">
                                              {new Date(point.created_at).toLocaleString()}
                                            </span>
                                            <span className="tabular-nums font-medium">
                                              {point.value.toLocaleString()} STP
                                            </span>
                                          </div>
                                        ))
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
}
