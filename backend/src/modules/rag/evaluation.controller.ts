import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Role, Roles } from '../../common';
import { EvaluationService, CreateEvalCaseInput } from './evaluation.service';

@ApiTags('RAG')
@Controller('rag')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('eval-cases')
  @ApiOperation({ summary: 'Create an evaluation case (admin only)' })
  @ApiResponse({ status: 201, description: 'Case created' })
  async createCase(@CurrentUser() user: JwtPayload, @Body() body: CreateEvalCaseInput) {
    return this.evaluationService.addCase(user.sub, body);
  }

  @Get('eval-cases')
  @ApiOperation({ summary: 'List evaluation cases (admin only)' })
  @ApiResponse({ status: 200, description: 'Cases returned' })
  async listCases(@Query('knowledgeBaseId') knowledgeBaseId?: string) {
    return this.evaluationService.listCases(knowledgeBaseId);
  }

  @Delete('eval-cases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an evaluation case (admin only)' })
  @ApiResponse({ status: 204, description: 'Case deleted' })
  async deleteCase(@Param('id') id: string) {
    await this.evaluationService.deleteCase(id);
  }

  @Post('evaluate')
  @ApiOperation({
    summary: 'Run retrieval evaluation over a knowledge base (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Evaluation report' })
  async evaluate(@Body() body: { knowledgeBaseId: string; k?: number; limit?: number }) {
    return this.evaluationService.run(body.knowledgeBaseId, {
      k: body.k,
      limit: body.limit,
    });
  }
}
