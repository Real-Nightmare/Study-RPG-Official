import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';
import { CampfireService, CampfireSourceKind } from './campfire.service';

export class StartCampfireDto {
  @IsOptional()
  @IsEnum(['session', 'battle', 'quiz', 'exam', 'teach_back'])
  sourceKind?: CampfireSourceKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class AnswerCampfireDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  answer: string;
}

@ApiTags('Study RPG Integrity')
@Controller('study-integrity/campfire')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CampfireController {
  constructor(private readonly campfire: CampfireService) {}

  @Get('status')
  @ApiOperation({ summary: "Today's campfire reflections, pending prompt and active multiplier" })
  status(@CurrentUser() user: JwtPayload) {
    return this.campfire.status(user.sub);
  }

  @Post()
  @ApiOperation({
    summary: "Ask the AI tutor's single targeted synthesis question (metacognitive loop)",
  })
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartCampfireDto) {
    return this.campfire.start(user.sub, dto);
  }

  @Post(':id/answer')
  @ApiOperation({
    summary: 'Submit the reflection answer — graded for depth (1.0x-1.5x multiplier)',
  })
  answer(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AnswerCampfireDto) {
    return this.campfire.submit(user.sub, id, dto.answer);
  }

  @Post(':id/skip')
  @ApiOperation({ summary: 'Defer the reflection (multiplier stays at base 1.0x)' })
  skip(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.campfire.skip(user.sub, id);
  }
}
