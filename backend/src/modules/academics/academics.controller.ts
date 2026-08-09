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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AcademicsService } from './academics.service';
import {
  UpdateAcademicProfileDto,
  CreateSubjectDto,
  UpdateSubjectDto,
  CreateChapterDto,
  UpdateChapterDto,
  CreateTopicDto,
  UpdateTopicDto,
  CreateExamDto,
  UpdateExamDto,
  AddPortionDto,
} from './dto/academics.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Academics')
@Controller('academics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  // ---------- Structure & profile ----------

  @Get('structure')
  @ApiOperation({ summary: 'Full academic structure (profile, subjects, chapters, topics, exams)' })
  @ApiResponse({ status: 200, description: 'Structure returned' })
  async structure(@CurrentUser() user: JwtPayload) {
    return this.academicsService.getStructure(user.sub);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the student academic profile' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  async profile(@CurrentUser() user: JwtPayload) {
    return this.academicsService.getProfile(user.sub);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Create or update the student academic profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateAcademicProfileDto) {
    return this.academicsService.updateProfile(user.sub, dto);
  }

  // ---------- Subjects ----------

  @Post('subjects')
  @ApiOperation({ summary: 'Create a subject' })
  @ApiResponse({ status: 201, description: 'Subject created' })
  @ApiResponse({ status: 409, description: 'Subject name already exists' })
  async createSubject(@CurrentUser() user: JwtPayload, @Body() dto: CreateSubjectDto) {
    return this.academicsService.createSubject(user.sub, dto);
  }

  @Put('subjects/:id')
  @ApiOperation({ summary: 'Update a subject' })
  @ApiResponse({ status: 200, description: 'Subject updated' })
  async updateSubject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.academicsService.updateSubject(user.sub, id, dto);
  }

  @Delete('subjects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a subject (cascades to chapters and topics)' })
  @ApiResponse({ status: 204, description: 'Subject deleted' })
  async deleteSubject(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.academicsService.deleteSubject(user.sub, id);
  }

  // ---------- Chapters ----------

  @Post('subjects/:subjectId/chapters')
  @ApiOperation({ summary: 'Create a chapter inside a subject' })
  @ApiResponse({ status: 201, description: 'Chapter created' })
  async createChapter(
    @CurrentUser() user: JwtPayload,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.academicsService.createChapter(user.sub, subjectId, dto);
  }

  @Put('chapters/:id')
  @ApiOperation({ summary: 'Update a chapter' })
  @ApiResponse({ status: 200, description: 'Chapter updated' })
  async updateChapter(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.academicsService.updateChapter(user.sub, id, dto);
  }

  @Delete('chapters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a chapter (cascades to topics)' })
  @ApiResponse({ status: 204, description: 'Chapter deleted' })
  async deleteChapter(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.academicsService.deleteChapter(user.sub, id);
  }

  // ---------- Topics ----------

  @Post('chapters/:chapterId/topics')
  @ApiOperation({ summary: 'Create a topic inside a chapter' })
  @ApiResponse({ status: 201, description: 'Topic created' })
  async createTopic(
    @CurrentUser() user: JwtPayload,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateTopicDto,
  ) {
    return this.academicsService.createTopic(user.sub, chapterId, dto);
  }

  @Put('topics/:id')
  @ApiOperation({ summary: 'Update a topic' })
  @ApiResponse({ status: 200, description: 'Topic updated' })
  async updateTopic(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.academicsService.updateTopic(user.sub, id, dto);
  }

  @Delete('topics/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a topic' })
  @ApiResponse({ status: 204, description: 'Topic deleted' })
  async deleteTopic(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.academicsService.deleteTopic(user.sub, id);
  }

  // ---------- Exams ----------

  @Get('exams')
  @ApiOperation({ summary: 'List exams with their portions' })
  @ApiResponse({ status: 200, description: 'Exams returned' })
  async listExams(@CurrentUser() user: JwtPayload) {
    return this.academicsService.listExams(user.sub);
  }

  @Post('exams')
  @ApiOperation({ summary: 'Create an exam' })
  @ApiResponse({ status: 201, description: 'Exam created' })
  async createExam(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    return this.academicsService.createExam(user.sub, dto);
  }

  @Put('exams/:id')
  @ApiOperation({ summary: 'Update an exam' })
  @ApiResponse({ status: 200, description: 'Exam updated' })
  async updateExam(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.academicsService.updateExam(user.sub, id, dto);
  }

  @Delete('exams/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an exam' })
  @ApiResponse({ status: 204, description: 'Exam deleted' })
  async deleteExam(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.academicsService.deleteExam(user.sub, id);
  }

  // ---------- Exam portions ----------

  @Post('exams/:examId/portions')
  @ApiOperation({ summary: 'Add a chapter to an exam portion' })
  @ApiResponse({ status: 201, description: 'Portion added' })
  @ApiResponse({ status: 409, description: 'Chapter already in portion' })
  async addPortion(
    @CurrentUser() user: JwtPayload,
    @Param('examId') examId: string,
    @Body() dto: AddPortionDto,
  ) {
    return this.academicsService.addPortion(user.sub, examId, dto);
  }

  @Delete('exams/:examId/portions/:portionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a chapter from an exam portion' })
  @ApiResponse({ status: 204, description: 'Portion removed' })
  async removePortion(
    @CurrentUser() user: JwtPayload,
    @Param('examId') examId: string,
    @Param('portionId') portionId: string,
  ) {
    await this.academicsService.removePortion(user.sub, examId, portionId);
  }
}
