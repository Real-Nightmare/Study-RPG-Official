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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MistakesService } from './mistakes.service';
import { CreateMistakeDto, UpdateMistakeDto, ResolveMistakeDto } from './dto/mistake.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Mistakes')
@Controller('mistakes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MistakesController {
  constructor(private readonly service: MistakesService) {}

  @Get()
  @ApiOperation({ summary: 'List mistakes with status counts' })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'resolved', 'reopened'] })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({ name: 'category', required: false })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('subject') subject?: string,
    @Query('category') category?: string,
  ) {
    return this.service.list(user.sub, { status, subject, category });
  }

  @Post()
  @ApiOperation({ summary: 'Record a mistake' })
  @ApiResponse({ status: 201, description: 'Mistake recorded' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMistakeDto) {
    return this.service.create(user.sub, dto);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve a mistake' })
  async resolve(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResolveMistakeDto,
  ) {
    return this.service.resolve(user.sub, id, dto);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a resolved mistake' })
  async reopen(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.reopen(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a mistake' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMistakeDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a mistake' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.service.delete(user.sub, id);
  }
}
