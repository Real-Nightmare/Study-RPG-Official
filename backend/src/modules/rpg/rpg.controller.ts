import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';
import { PlayerService } from './player.service';
import { WalletService } from './wallet.service';
import { CardService } from './card.service';
import { BattleService } from './battle.service';
import { PvpService } from './pvp.service';
import { PartyService } from './party.service';
import { EXAM_BOSSES } from './exam-bosses';
import {
  BattleActionDto,
  CreateBattleDto,
  CreateDeckDto,
  CreatePvpDuelDto,
  DamageChallengeDto,
  ManaQuizDto,
  UpdateDeckDto,
} from './dto/rpg.dto';

@ApiTags('Study RPG')
@Controller('rpg')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RpgController {
  constructor(
    private readonly player: PlayerService,
    private readonly wallet: WalletService,
    private readonly cards: CardService,
    private readonly battles: BattleService,
    private readonly pvp: PvpService,
    private readonly party: PartyService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Player profile: level, XP, STP/SLC balance, stats' })
  async profile(@CurrentUser() user: JwtPayload) {
    await this.cards.grantStarterSet(user.sub);
    return this.player.getProfile(user.sub);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Immutable STP/SLC wallet ledger' })
  async ledger(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    await this.cards.grantStarterSet(user.sub);
    return this.wallet.getLedger(user.sub, limit ? Number(limit) : 50);
  }

  @Get('cards')
  @ApiOperation({ summary: 'All card definitions' })
  async listCards(@CurrentUser() user: JwtPayload) {
    await this.cards.grantStarterSet(user.sub);
    return this.cards.getDefinitions();
  }

  @Get('collection')
  @ApiOperation({ summary: 'Owned card instances' })
  async collection(@CurrentUser() user: JwtPayload) {
    await this.cards.grantStarterSet(user.sub);
    return this.cards.getCollection(user.sub);
  }

  @Get('decks')
  @ApiOperation({ summary: 'List decks' })
  async listDecks(@CurrentUser() user: JwtPayload) {
    await this.cards.grantStarterSet(user.sub);
    return this.cards.listDecks(user.sub);
  }

  @Post('decks')
  @ApiOperation({ summary: 'Create a deck' })
  async createDeck(@CurrentUser() user: JwtPayload, @Body() dto: CreateDeckDto) {
    await this.cards.grantStarterSet(user.sub);
    return this.cards.createDeck(user.sub, dto.name, dto.cardInstanceIds);
  }

  @Get('decks/:id')
  @ApiOperation({ summary: 'Get a deck' })
  async getDeck(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cards.getDeck(user.sub, id);
  }

  @Put('decks/:id')
  @ApiOperation({ summary: 'Update a deck (name and/or cards)' })
  async updateDeck(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto,
  ) {
    return this.cards.updateDeck(user.sub, id, dto.name, dto.cardInstanceIds);
  }

  @Post('decks/:id/equip')
  @ApiOperation({ summary: 'Set a deck as the active deck' })
  async equipDeck(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cards.setActiveDeck(user.sub, id);
  }

  @Delete('decks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a deck' })
  async deleteDeck(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.cards.deleteDeck(user.sub, id);
  }

  @Post('battles')
  @ApiOperation({ summary: 'Start a battle' })
  async createBattle(@CurrentUser() user: JwtPayload, @Body() dto: CreateBattleDto) {
    await this.cards.grantStarterSet(user.sub);
    return this.battles.create(user.sub, dto);
  }

  @Get('battles/history')
  @ApiOperation({ summary: 'Recent battles' })
  async battleHistory(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.battles.history(user.sub, limit ? Number(limit) : 20);
  }

  @Get('battles/:id')
  @ApiOperation({ summary: 'Battle state + log' })
  async getBattle(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.battles.get(user.sub, id);
  }

  @Post('battles/:id/action')
  @ApiOperation({ summary: 'Play a card' })
  async battleAction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: BattleActionDto,
  ) {
    return this.battles.action(user.sub, id, dto);
  }

  @Post('battles/:id/quiz')
  @ApiOperation({ summary: 'Grade the mana-recovery quiz' })
  async manaQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ManaQuizDto,
  ) {
    return this.battles.manaQuiz(user.sub, id, dto.correctCount);
  }

  @Post('battles/:id/challenge')
  @ApiOperation({ summary: 'Grade the one-turn damage challenge' })
  async damageChallenge(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DamageChallengeDto,
  ) {
    return this.battles.damageChallenge(user.sub, id, dto.allCorrect);
  }

  @Post('battles/:id/forfeit')
  @ApiOperation({ summary: 'Forfeit a battle' })
  async forfeit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.battles.forfeit(user.sub, id);
  }

  // ---------------- PvP duels (Phase 5) ----------------

  @Post('pvp/duels')
  @ApiOperation({ summary: 'Create a PvP duel (by email or random matchmaking)' })
  async createPvpDuel(@CurrentUser() user: JwtPayload, @Body() dto: CreatePvpDuelDto) {
    await this.cards.grantStarterSet(user.sub);
    return this.pvp.create(user.sub, dto);
  }

  @Get('pvp/duels')
  @ApiOperation({ summary: 'List duels involving the current player' })
  async listPvpDuels(@CurrentUser() user: JwtPayload) {
    return this.pvp.list(user.sub);
  }

  @Get('pvp/duels/:id')
  @ApiOperation({ summary: 'Get a duel + my battle state' })
  async getPvpDuel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.pvp.get(user.sub, id);
  }

  @Post('pvp/duels/:id/battle')
  @ApiOperation({ summary: 'Start my battle vs the opponent ghost' })
  async startPvpBattle(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.pvp.startBattle(user.sub, id);
  }

  @Get('pvp/leaderboard')
  @ApiOperation({ summary: 'Top players by battle rating' })
  async pvpLeaderboard(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.pvp.leaderboard(limit ? Number(limit) : 20);
  }

  // ---------------- Party battles (Phase 6) ----------------

  @Get('exam-bosses')
  @ApiOperation({ summary: 'Exam boss roster (exams are boss fights)' })
  async examBosses() {
    return EXAM_BOSSES.map((b) => ({
      key: b.key,
      name: b.name,
      subject: b.subject,
      lore: b.lore,
    }));
  }

  @Get('parties/mine')
  @ApiOperation({ summary: 'My party' })
  async myParty(@CurrentUser() user: JwtPayload) {
    return this.party.myParty(user.sub);
  }

  @Post('parties')
  @ApiOperation({ summary: 'Create a study party (leader + up to 3 friends)' })
  async createParty(@CurrentUser() user: JwtPayload, @Body() body: { name?: string }) {
    return this.party.createParty(user.sub, body.name || 'Study Squad');
  }

  @Get('parties/:id')
  @ApiOperation({ summary: 'Get a party' })
  async getParty(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.party.getParty(user.sub, id);
  }

  @Post('parties/:id/invite')
  @ApiOperation({ summary: 'Invite an accepted friend (max 4 members)' })
  async inviteToParty(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { friendId: string },
  ) {
    return this.party.invite(user.sub, id, body.friendId);
  }

  @Post('parties/:id/leave')
  @ApiOperation({ summary: 'Leave a party' })
  async leaveParty(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.party.leave(user.sub, id);
    return { ok: true };
  }

  @Post('parties/:id/battles')
  @ApiOperation({ summary: 'Start a party battle (vs exam boss or any boss)' })
  async startPartyBattle(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { examId?: string; bossKey?: string },
  ) {
    return this.party.startBattle(user.sub, id, { examId: body.examId, bossKey: body.bossKey });
  }

  @Get('parties/:id/battles')
  @ApiOperation({ summary: 'Party battle history' })
  async listPartyBattles(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.party.listBattles(user.sub, id);
  }

  @Get('party-battles/:id')
  @ApiOperation({ summary: 'Get a party battle state' })
  async getPartyBattle(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.party.getBattle(user.sub, id);
  }

  @Post('party-battles/:id/action')
  @ApiOperation({ summary: 'Play a card in a party battle' })
  async partyBattleAction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { cardInstanceId: string },
  ) {
    return this.party.action(user.sub, id, body);
  }

  @Post('party-battles/:id/forfeit')
  @ApiOperation({ summary: 'Forfeit a party battle' })
  async forfeitPartyBattle(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.party.forfeit(user.sub, id);
  }
}
