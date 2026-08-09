import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueueService } from '../queue/queue.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, Role } from '../../common';

@ApiTags('RAG')
@Controller('rag')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(private readonly queueService: QueueService) {}

  @Post('reindex')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Enqueue a background vector index reindex (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Reindex job queued' })
  async reindex(@Body() body: { fromVersion: string; toVersion: string }) {
    if (!body.fromVersion || !body.toVersion) {
      return { error: 'fromVersion and toVersion are required' };
    }
    const job = await this.queueService.addJob('rag-reindex', 'reindex', {
      fromVersion: body.fromVersion,
      toVersion: body.toVersion,
    });
    this.logger.log(`Reindex job ${job.id} queued: '${body.fromVersion}' → '${body.toVersion}'`);
    return { message: 'Reindex queued', jobId: job.id };
  }
}
