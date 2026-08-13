import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseGateway } from '../../common/gateways/base.gateway';
import { parseCorsOrigins } from '../../common/config/cors-origins';

@WebSocketGateway({
  namespace: 'social',
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  },
})
export class SocialGateway extends BaseGateway {
  protected readonly logger = new Logger(SocialGateway.name);

  @SubscribeMessage('social:subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket): { event: string; data: { ok: boolean } } {
    const user = this.getUserFromSocket(client);
    if (!user) {
      return { event: 'error', data: { ok: false } };
    }
    // BaseGateway already joins `user:<id>` on connection; nothing else needed.
    return { event: 'social:subscribed', data: { ok: true } };
  }

  /** Emit a new DM to a recipient's socket room (fire-and-forget). */
  emitDirectMessage(recipientId: string, message: unknown) {
    this.emitToUser(recipientId, 'dm:new', message);
  }

  /** Emit a friend-list change (request accepted, new request, blocked). */
  emitFriendUpdate(userId: string, update: unknown) {
    this.emitToUser(userId, 'friend:update', update);
  }

  @SubscribeMessage('social:typing')
  handleTyping(
    @MessageBody() data: { recipientId: string; typing: boolean },
    @ConnectedSocket() client: Socket,
  ): { event: string } {
    const user = this.getUserFromSocket(client);
    if (!user) {
      return { event: 'error' };
    }
    this.emitToUser(data.recipientId, 'dm:typing', {
      from: user.sub,
      typing: data.typing,
    });
    return { event: 'sent' };
  }
}
