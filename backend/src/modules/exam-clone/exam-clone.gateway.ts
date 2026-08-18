import { Logger, UseGuards, UseFilters } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parseCorsOrigins } from '../../common/config/cors-origins';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';
import { DatabaseService } from '../database/database.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { v4 as uuidv4 } from 'uuid';

interface SessionParticipant {
  userId: string;
  userName: string;
  nickname: string;
  score: number;
  correctCount: number;
  currentQuestion: number;
  finishedAt?: Date;
}

interface LeaderboardEntry {
  userId: string;
  nickname: string;
  score: number;
  correctCount: number;
  finished: boolean;
}

/**
 * Realtime home for exam clones: progress events for the analysis pipeline
 * plus Pro-only collaborative sessions (shared room, live leaderboard, chat).
 */
@WebSocketGateway({
  namespace: 'exam-clone',
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  },
})
@UseGuards(WsAuthGuard)
@UseFilters(WsExceptionFilter)
export class ExamCloneGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(ExamCloneGateway.name);
  private sessionParticipants = new Map<string, Map<string, SessionParticipant>>();

  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @WebSocketServer()
  server: Server;

  async handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub;
    if (!userId) return;

    for (const [sessionCode, participants] of this.sessionParticipants.entries()) {
      if (participants.has(userId)) {
        participants.delete(userId);
        this.server.to(`session:${sessionCode}`).emit('participant-left', { userId });
        this.emitLeaderboard(sessionCode);
      }
    }
  }

  // ==================== EXAM CLONE PROGRESS ====================

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() data: { examCloneId: string }, @ConnectedSocket() client: Socket) {
    client.join(`exam-clone:${data.examCloneId}`);
    this.logger.debug(`Client ${client.id} subscribed to exam clone ${data.examCloneId}`);
    return { event: 'subscribed', data: { examCloneId: data.examCloneId } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { examCloneId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`exam-clone:${data.examCloneId}`);
    return { event: 'unsubscribed', data: { examCloneId: data.examCloneId } };
  }

  notifyProgress(
    examCloneId: string,
    progress: { stage: string; percentage: number; message: string },
  ) {
    this.server.to(`exam-clone:${examCloneId}`).emit('progress', progress);
  }

  notifyComplete(examCloneId: string, data: { questionCount: number }) {
    this.server.to(`exam-clone:${examCloneId}`).emit('complete', data);
  }

  notifyError(examCloneId: string, error: { message: string }) {
    this.server.to(`exam-clone:${examCloneId}`).emit('error', error);
  }

  // ==================== COLLABORATIVE EXAM SESSIONS ====================

  @SubscribeMessage('create-session')
  async handleCreateSession(
    @MessageBody()
    data: { examCloneId: string; name: string; nickname?: string; settings: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    const userName = client.data.user?.email?.split('@')[0] || 'Host';
    const hostNickname = data.nickname || userName;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const isPro = await this.subscriptionService.isPro(userId);
    if (!isPro) {
      client.emit('error', {
        message: 'This feature requires a Pro plan',
        upgrade: true,
        feature: 'exam_clone',
      });
      return;
    }

    try {
      const code = this.generateSessionCode();
      const sessionId = uuidv4();

      await this.db.query(
        `INSERT INTO exam_sessions (id, exam_clone_id, host_id, code, name, settings, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'waiting', NOW())`,
        [
          sessionId,
          data.examCloneId,
          userId,
          code,
          data.name || 'Practice Session',
          JSON.stringify(data.settings || {}),
        ],
      );

      this.sessionParticipants.set(code, new Map());
      this.sessionParticipants.get(code)!.set(userId, {
        userId,
        userName,
        nickname: hostNickname,
        score: 0,
        correctCount: 0,
        currentQuestion: 0,
      });

      await this.db.query(
        `INSERT INTO exam_session_participants (id, session_id, user_id, nickname, joined_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [uuidv4(), sessionId, userId, hostNickname],
      );

      client.join(`session:${code}`);

      this.logger.log(`Session created: ${code} by user ${userId}`);
      client.emit('session-created', { sessionId, code });
      this.emitLeaderboard(code);
    } catch (error) {
      this.logger.error(`Failed to create session: ${error}`);
      client.emit('error', { message: 'Failed to create session' });
    }
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @MessageBody() data: { code: string; nickname?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    const userName = client.data.user?.email?.split('@')[0] || 'Anonymous';
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await this.db.queryOne<any>('SELECT * FROM exam_sessions WHERE code = $1', [
        data.code.toUpperCase(),
      ]);

      if (!session) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      if (session.status === 'completed') {
        client.emit('error', { message: 'Session has ended' });
        return;
      }

      await this.db.query(
        `INSERT INTO exam_session_participants (id, session_id, user_id, nickname, joined_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (session_id, user_id) DO UPDATE SET nickname = $4`,
        [uuidv4(), session.id, userId, data.nickname || userName],
      );

      if (!this.sessionParticipants.has(data.code)) {
        this.sessionParticipants.set(data.code, new Map());
      }
      this.sessionParticipants.get(data.code)!.set(userId, {
        userId,
        userName,
        nickname: data.nickname || userName,
        score: 0,
        correctCount: 0,
        currentQuestion: 0,
      });

      client.join(`session:${data.code}`);

      this.server.to(`session:${data.code}`).emit('participant-joined', {
        userId,
        nickname: data.nickname || userName,
      });

      this.emitLeaderboard(data.code);

      this.logger.log(`User ${userId} joined session ${data.code}`);
      client.emit('joined-session', {
        sessionId: session.id,
        examCloneId: session.exam_clone_id,
        status: session.status,
        settings: session.settings,
        hostId: session.host_id,
      });
    } catch (error) {
      this.logger.error(`Failed to join session: ${error}`);
      client.emit('error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('start-session')
  async handleStartSession(
    @MessageBody() data: { code: string; questionIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await this.db.queryOne<any>(
        'SELECT * FROM exam_sessions WHERE code = $1 AND host_id = $2',
        [data.code, userId],
      );

      if (!session) {
        client.emit('error', { message: 'Only host can start the session' });
        return;
      }

      await this.db.query(
        `UPDATE exam_sessions SET status = 'in_progress', question_ids = $1, started_at = NOW() WHERE code = $2`,
        [JSON.stringify(data.questionIds), data.code],
      );

      this.server.to(`session:${data.code}`).emit('session-started', {
        questionIds: data.questionIds,
        startedAt: new Date(),
      });

      this.logger.log(`Session ${data.code} started`);
    } catch (error) {
      this.logger.error(`Failed to start session: ${error}`);
      client.emit('error', { message: 'Failed to start session' });
    }
  }

  @SubscribeMessage('submit-answer')
  async handleSubmitAnswer(
    @MessageBody()
    data: {
      code: string;
      questionId: string;
      answer: string;
      isCorrect: boolean;
      timeSpent: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const participants = this.sessionParticipants.get(data.code);
    if (!participants?.has(userId)) {
      client.emit('error', { message: 'Not in session' });
      return;
    }

    try {
      const participant = participants.get(userId)!;

      if (data.isCorrect) {
        // Speed-scored: faster answers earn more (100 max, 50 floor).
        const speedBonus = Math.max(50, 100 - data.timeSpent);
        participant.score += speedBonus;
        participant.correctCount++;
      }
      participant.currentQuestion++;

      await this.db.query(
        `UPDATE exam_session_participants SET score = $1, correct_count = $2, current_question = $3
         WHERE session_id = (SELECT id FROM exam_sessions WHERE code = $4) AND user_id = $5`,
        [
          participant.score,
          participant.correctCount,
          participant.currentQuestion,
          data.code,
          userId,
        ],
      );

      this.emitLeaderboard(data.code);
      client.emit('answer-submitted', { score: participant.score });
    } catch (error) {
      this.logger.error(`Failed to submit answer: ${error}`);
      client.emit('error', { message: 'Failed to submit answer' });
    }
  }

  @SubscribeMessage('finish-session')
  async handleFinishSession(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const participants = this.sessionParticipants.get(data.code);
    if (!participants?.has(userId)) {
      client.emit('error', { message: 'Not in session' });
      return;
    }

    try {
      const participant = participants.get(userId)!;
      participant.finishedAt = new Date();

      await this.db.query(
        `UPDATE exam_session_participants SET finished_at = NOW()
         WHERE session_id = (SELECT id FROM exam_sessions WHERE code = $1) AND user_id = $2`,
        [data.code, userId],
      );

      this.server.to(`session:${data.code}`).emit('participant-finished', {
        userId,
        score: participant.score,
        correctCount: participant.correctCount,
      });

      this.emitLeaderboard(data.code);
      client.emit('finished', { score: participant.score });
    } catch (error) {
      this.logger.error(`Failed to finish session: ${error}`);
      client.emit('error', { message: 'Failed to finish session' });
    }
  }

  @SubscribeMessage('end-session')
  async handleEndSession(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await this.db.queryOne<any>(
        'SELECT * FROM exam_sessions WHERE code = $1 AND host_id = $2',
        [data.code, userId],
      );

      if (!session) {
        client.emit('error', { message: 'Only host can end the session' });
        return;
      }

      await this.db.query(
        `UPDATE exam_sessions SET status = 'completed', ended_at = NOW() WHERE code = $1`,
        [data.code],
      );

      const leaderboard = this.getLeaderboard(data.code);
      this.server.to(`session:${data.code}`).emit('session-ended', {
        finalLeaderboard: leaderboard,
      });

      this.sessionParticipants.delete(data.code);

      this.logger.log(`Session ${data.code} ended`);
    } catch (error) {
      this.logger.error(`Failed to end session: ${error}`);
      client.emit('error', { message: 'Failed to end session' });
    }
  }

  @SubscribeMessage('chat-message')
  handleChatMessage(
    @MessageBody() data: { code: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.sub;
    const userName = client.data.user?.email?.split('@')[0] || 'Anonymous';
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const participants = this.sessionParticipants.get(data.code);
    const nickname = participants?.get(userId)?.nickname || userName;

    this.server.to(`session:${data.code}`).emit('chat-message', {
      userId,
      nickname,
      message: data.message,
      timestamp: new Date(),
    });
  }

  // ==================== HELPER METHODS ====================

  private generateSessionCode(): string {
    // Ambiguity-safe alphabet: no 0/O/1/I.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private getLeaderboard(code: string): LeaderboardEntry[] {
    const participants = this.sessionParticipants.get(code);
    if (!participants) return [];

    return Array.from(participants.values())
      .map((p) => ({
        userId: p.userId,
        nickname: p.nickname,
        score: p.score,
        correctCount: p.correctCount,
        finished: !!p.finishedAt,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private emitLeaderboard(code: string) {
    const leaderboard = this.getLeaderboard(code);
    this.server.to(`session:${code}`).emit('leaderboard-update', { leaderboard });
  }
}
