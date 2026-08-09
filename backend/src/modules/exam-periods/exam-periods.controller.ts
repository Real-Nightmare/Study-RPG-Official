import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExamPeriodsService } from './exam-periods.service';
import {
  CreateExamPeriodDto,
  UpdateExamPeriodDto,
  AttachExamsDto,
  RecordExamResultDto,
} from './dto/exam-period.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Exam Periods')
@Controller('exam-periods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExamPeriodsController {
  constructor(private readonly service: ExamPeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'List exam periods with derived status and attached exams' })
  async list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.sub);
  }

  @Get('nearest-exam')
  @ApiOperation({ summary: 'Nearest upcoming exam within the horizon' })
  async nearest(@CurrentUser() user: JwtPayload, @Query('horizonDays') horizonDays?: string) {
    return this.service.nearestUpcomingExam(user.sub, horizonDays ? Number(horizonDays) : 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one exam period' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.findOne(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an exam period' })
  @ApiResponse({ status: 201, description: 'Exam period created' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamPeriodDto) {
    return this.service.create(user.sub, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an exam period' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExamPeriodDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Post(':id/exams')
  @ApiOperation({ summary: 'Attach exams to a period' })
  async attach(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AttachExamsDto,
  ) {
    return this.service.attachExams(user.sub, id, dto);
  }

  @Post('exams/:examId/results')
  @ApiOperation({ summary: 'Record an exam result' })
  async recordResult(
    @CurrentUser() user: JwtPayload,
    @Param('examId') examId: string,
    @Body() dto: RecordExamResultDto,
  ) {
    return this.service.recordResult(user.sub, examId, dto);
  }

  @Get('results/all')
  @ApiOperation({ summary: 'List recorded exam results' })
  async results(@CurrentUser() user: JwtPayload, @Query('examId') examId?: string) {
    return this.service.results(user.sub, examId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an exam period' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.service.delete(user.sub, id);
  }
}
