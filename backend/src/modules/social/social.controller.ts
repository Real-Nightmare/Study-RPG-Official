import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { SocialGateway } from './social.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Social')
@Controller('social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly gateway: SocialGateway,
  ) {}

  @Get('users/search')
  @ApiOperation({ summary: 'Search users to add as friends' })
  async search(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.social.searchUsers(q, limit ? Number(limit) : 10);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Friends and pending requests' })
  async friends(@CurrentUser() user: JwtPayload) {
    return this.social.listFriends(user.sub);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Accepted friends (conversation list)' })
  async conversations(@CurrentUser() user: JwtPayload) {
    return this.social.listConversations(user.sub);
  }

  @Post('friends/request')
  @ApiOperation({ summary: 'Send a friend request' })
  async request(@CurrentUser() user: JwtPayload, @Body() body: { addresseeId: string }) {
    await this.social.sendFriendRequest(user.sub, body.addresseeId);
    return { ok: true };
  }

  @Post('friends/:id/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  async accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.social.respondToRequest(user.sub, id, true);
    return { ok: true };
  }

  @Post('friends/:id/decline')
  @ApiOperation({ summary: 'Decline a friend request' })
  async decline(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.social.respondToRequest(user.sub, id, false);
    return { ok: true };
  }

  @Post('friends/block')
  @ApiOperation({ summary: 'Block a user' })
  async block(@CurrentUser() user: JwtPayload, @Body() body: { targetId: string }) {
    await this.social.blockUser(user.sub, body.targetId);
    return { ok: true };
  }

  @Get('messages/:friendId')
  @ApiOperation({ summary: 'Message history with a friend' })
  async messages(
    @CurrentUser() user: JwtPayload,
    @Param('friendId') friendId: string,
    @Query('limit') limit?: string,
  ) {
    const msgs = await this.social.getMessages(user.sub, friendId, limit ? Number(limit) : 100);
    await this.social.markRead(user.sub, friendId);
    return msgs;
  }

  @Post('messages/:friendId')
  @ApiOperation({ summary: 'Send a message to a friend (realtime via social socket)' })
  async send(
    @CurrentUser() user: JwtPayload,
    @Param('friendId') friendId: string,
    @Body() body: { content: string },
  ) {
    const message = await this.social.sendMessage(user.sub, friendId, body.content);
    this.gateway.emitDirectMessage(friendId, { ...message, from: user.sub });
    return message;
  }

  @Get('unread')
  @ApiOperation({ summary: 'Unread message count' })
  async unread(@CurrentUser() user: JwtPayload) {
    return { count: await this.social.unreadCount(user.sub) };
  }
}
