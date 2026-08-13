import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common';
import { EconomyService } from './economy.service';
import { BurnerService } from './burner.service';
import { SupplyService } from './supply.service';
import {
  ConfirmRemovalDto,
  ListCardDto,
  MakeOfferDto,
  MarketplaceQueryDto,
  MoveCardDto,
} from './dto/economy.dto';

@ApiTags('Study RPG Economy')
@Controller('economy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EconomyController {
  constructor(
    private readonly economy: EconomyService,
    private readonly burner: BurnerService,
    private readonly supply: SupplyService,
  ) {}

  // ---------------------------------------------------------------------------
  // Marketplace (§20)
  // ---------------------------------------------------------------------------

  @Get('marketplace')
  @ApiOperation({ summary: 'Active marketplace listings (buy/sell original cards with STP)' })
  async marketplace(@CurrentUser() user: JwtPayload, @Query() query: MarketplaceQueryDto) {
    return this.economy.listMarketplace(user.sub, {
      rarity: query.rarity,
      cardKey: query.cardKey,
      mine: query.mine === true || (query.mine as unknown as string) === 'true',
    });
  }

  @Post('marketplace/listings')
  @ApiOperation({ summary: 'List an owned card at a fixed STP price' })
  async listCard(@CurrentUser() user: JwtPayload, @Body() body: ListCardDto) {
    return this.economy.listCard(user.sub, body);
  }

  @Delete('marketplace/listings/:id')
  @ApiOperation({ summary: 'Cancel your active listing' })
  async cancelListing(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.economy.cancelListing(user.sub, id);
  }

  @Post('marketplace/listings/:id/buy')
  @ApiOperation({ summary: 'Buy a listed card at its fixed price' })
  async buyListing(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.economy.buyListing(user.sub, id);
  }

  // ---------------------------------------------------------------------------
  // Offers (§20)
  // ---------------------------------------------------------------------------

  @Get('marketplace/offers')
  @ApiOperation({ summary: 'Offers I made or received' })
  async myOffers(@CurrentUser() user: JwtPayload) {
    return this.economy.myOffers(user.sub);
  }

  @Post('marketplace/listings/:id/offers')
  @ApiOperation({ summary: 'Make a buy offer on a listing' })
  async makeOffer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: MakeOfferDto,
  ) {
    return this.economy.makeOffer(user.sub, id, body.amount);
  }

  @Post('marketplace/offers/:id/accept')
  @ApiOperation({ summary: 'Accept an offer on your listing (sells at the offered price)' })
  async acceptOffer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.economy.acceptOffer(user.sub, id);
  }

  @Post('marketplace/offers/:id/decline')
  @ApiOperation({ summary: 'Decline an offer on your listing' })
  async declineOffer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.economy.declineOffer(user.sub, id);
  }

  @Post('marketplace/offers/:id/cancel')
  @ApiOperation({ summary: 'Withdraw your pending offer' })
  async cancelOffer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.economy.cancelOffer(user.sub, id);
  }

  // ---------------------------------------------------------------------------
  // Collection & vault (§18)
  // ---------------------------------------------------------------------------

  @Get('cards')
  @ApiOperation({ summary: 'My collection with storage location, deck/listing flags and value' })
  async myCards(@CurrentUser() user: JwtPayload) {
    return this.economy.myCards(user.sub);
  }

  @Post('cards/:id/move')
  @ApiOperation({ summary: 'Move a card between inventory and vault' })
  async moveCard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: MoveCardDto,
  ) {
    return this.economy.moveCard(user.sub, id, body.location);
  }

  // ---------------------------------------------------------------------------
  // Scraper & burner (§22, §23)
  // ---------------------------------------------------------------------------

  @Post('cards/:id/scrape')
  @ApiOperation({ summary: 'Scrap a card — permanent removal, immediate payout at official value' })
  async scrapeCard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: ConfirmRemovalDto,
  ) {
    return this.burner.scrapeCard(user.sub, id, body.confirm);
  }

  @Post('cards/:id/burn')
  @ApiOperation({ summary: 'Burn a card — permanent removal, payout in instalments' })
  async burnCard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: ConfirmRemovalDto,
  ) {
    return this.burner.burnCard(user.sub, id, body.confirm);
  }

  @Get('cards/:id/burn-status')
  @ApiOperation({ summary: 'Instalment progress of a burn' })
  async burnStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.burner.burnStatus(user.sub, id);
  }

  // ---------------------------------------------------------------------------
  // Supply (§16.3, §21, §24)
  // ---------------------------------------------------------------------------

  @Get('supply')
  @ApiOperation({
    summary: 'Supply report: original/active/burned/scraped/listed + value + extinction',
  })
  async supplyReport() {
    return this.supply.getSupplyReport();
  }

  @Get('supply/:cardKey/history')
  @ApiOperation({ summary: 'Official value history for a card' })
  async priceHistory(@Param('cardKey') cardKey: string) {
    return this.supply.getPriceHistory(cardKey);
  }

  // ---------------------------------------------------------------------------
  // Admin (§21–§24 housekeeping)
  // ---------------------------------------------------------------------------

  @Post('admin/reconcile')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: reconcile supply counters and official values' })
  async reconcile() {
    return this.supply.reconcile();
  }

  @Post('admin/process-burn-instalments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: pay all due burn instalments now' })
  async processInstalments() {
    return this.burner.processDueInstalments();
  }
}
