import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService, CreateManagedUserDto, UpdateManagedUserDto } from './admin.service';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- User management (admin only) ----------------

  @Get('users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users (admin)' })
  async listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.admin.listUsers({
      search,
      role,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Post('users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create an account (admin, reason required)' })
  async createUser(@CurrentUser() user: JwtPayload, @Body() dto: CreateManagedUserDto) {
    return this.admin.createUser(user.sub, dto);
  }

  @Post('users/:id/update')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a user — role, active, name (reason required)' })
  async updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.admin.updateUser(user.sub, id, dto);
  }

  @Post('users/:id/reset-password')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reset a user password (reason required)' })
  async resetPassword(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { newPassword: string; reason: string },
  ) {
    await this.admin.resetPassword(user.sub, id, body.newPassword, body.reason);
    return { ok: true };
  }

  // ---------------- Audit logs (admin + teacher) ----------------

  @Get('audit-logs')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Audit log — admins and teachers can verify every admin action with its reason',
  })
  async auditLogs(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.list({
      actorId,
      action,
      targetType,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  // ---------------- Phase 9: audit export + retention ----------------

  @Get('audit-logs/export')
  @Roles(Role.ADMIN, Role.TEACHER)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  @ApiOperation({ summary: 'Export the audit log as CSV (admin/teacher)' })
  async exportAuditLogs(
    @Query('format') format?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('limit') limit?: string,
  ) {
    if (format === 'json') {
      return this.audit.exportJson({
        actorId,
        action,
        targetType,
        limit: limit ? Number(limit) : 5000,
      });
    }
    return this.audit.exportCsv({
      actorId,
      action,
      targetType,
      limit: limit ? Number(limit) : 5000,
    });
  }

  @Get('audit-logs/retention')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Current audit-log retention window (days)' })
  async retention() {
    return this.audit.getRetention();
  }

  @Post('audit-logs/retention')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Set the audit-log retention window (admin, reason required)' })
  async setRetention(
    @CurrentUser() user: JwtPayload,
    @Body() body: { retentionDays: number; reason: string },
  ) {
    await this.audit.setRetention(user.sub, body.retentionDays, body.reason);
    return this.audit.getRetention();
  }

  @Post('audit-logs/purge')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Purge audit entries older than the retention window now' })
  async purge(@CurrentUser() user: JwtPayload) {
    const { retentionDays } = await this.audit.getRetention();
    return this.audit.purgeOlderThan(retentionDays, user.sub);
  }

  // ---------------- Phase 9: system status dashboard ----------------

  @Get('status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'System status — counts, queue stats, service health' })
  async status() {
    return this.admin.status();
  }
}
