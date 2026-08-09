import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminNotesService, CreateAdminNoteDto } from './admin-notes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin Notes & Syllabus')
@Controller('admin-notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminNotesController {
  constructor(private readonly notes: AdminNotesService) {}

  // ---------------- Universal admin notes ----------------

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a universal admin note (PDF page selection supported so the AI never cites the wrong page)',
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdminNoteDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.notes.create(user.sub, dto, file);
  }

  @Get()
  @ApiOperation({ summary: 'List universal admin notes' })
  async list(
    @Query('subject') subject?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notes.list({
      subject,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one admin note' })
  async get(@Param('id') id: string) {
    return this.notes.get(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Delete an admin note (reason required)' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    await this.notes.remove(user.sub, id, body.reason);
    return { ok: true };
  }

  // ---------------- Syllabus (admin-only write, student read) ----------------

  @Post('syllabus')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Upsert a syllabus entry (admin only, reason required)' })
  async upsertSyllabus(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      board: string;
      grade: string;
      subject: string;
      chapters: Array<{ name: string; topics?: string[] }>;
      reason: string;
    },
  ) {
    return this.notes.createSyllabus(user.sub, body, body.reason);
  }

  @Get('syllabus')
  @ApiOperation({ summary: 'Browse the official syllabus (everyone)' })
  async listSyllabus(
    @Query('board') board?: string,
    @Query('grade') grade?: string,
    @Query('subject') subject?: string,
  ) {
    return this.notes.listSyllabus({ board, grade, subject });
  }

  @Delete('syllabus/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a syllabus entry (reason required)' })
  async removeSyllabus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    await this.notes.removeSyllabus(user.sub, id, body.reason);
    return { ok: true };
  }
}
