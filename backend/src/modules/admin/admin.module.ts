import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditService } from './audit.service';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [UsersModule, QueueModule, RedisModule, QdrantModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService],
  exports: [AuditService],
})
export class AdminModule {}
