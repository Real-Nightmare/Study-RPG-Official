import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AuthModule } from '../auth/auth.module';
import { AdminNotesModule } from '../admin-notes/admin-notes.module';

@Module({
  imports: [KnowledgeBaseModule, AuthModule, AdminNotesModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
