import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { WsExceptionFilter } from '../filters/ws-exception.filter';

/**
 * Shared socket gateway plumbing: JWT auth on connect, unified error
 * handling, per-user rooms, and a repo-wide live-connection counter that
 * other subsystems (e.g. the idle-capacity Ocean Node monitor) use to decide
 * whether the server is genuinely idle.
 */
@UseGuards(WsAuthGuard)
@UseFilters(WsExceptionFilter)
export abstract class BaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  protected abstract readonly logger: Logger;

  /**
   * Repo-wide count of live WebSocket connections across ALL gateway
   * namespaces. Static on the shared base so every gateway instance updates
   * the same counter; the idle-capacity Ocean Node monitor uses it as one of
   * its "is the server actually idle?" signals.
   */
  private static connectionCount = 0;

  /** Number of currently connected sockets across all namespaces. */
  static get activeConnections(): number {
    return BaseGateway.connectionCount;
  }

  @WebSocketServer()
  protected server: Server;

  afterInit(_server: Server) {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.data.user?.sub;
    this.logger.log(`Client connected: ${client.id} (user: ${userId || 'unauthenticated'})`);
    BaseGateway.connectionCount += 1;

    if (userId) {
      client.join(`user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub;
    this.logger.log(`Client disconnected: ${client.id} (user: ${userId || 'unauthenticated'})`);
    BaseGateway.connectionCount = Math.max(0, BaseGateway.connectionCount - 1);
  }

  protected emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  protected emitToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }

  protected broadcast(event: string, data: unknown) {
    this.server.emit(event, data);
  }

  protected joinRoom(client: Socket, room: string) {
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room: ${room}`);
  }

  protected leaveRoom(client: Socket, room: string) {
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room: ${room}`);
  }

  protected getUserFromSocket(client: Socket): { sub: string; email: string; role: string } | null {
    return client.data.user || null;
  }
}
