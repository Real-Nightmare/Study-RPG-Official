import { Controller, Get, Post, Body, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

const METERED_FEATURES = ['ai_requests', 'study_sets', 'flashcards'];

@ApiTags('Subscription')
@Controller('subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Owner policy T8: payments are infrastructure-level only and disabled by
   * default. While BILLING_ENABLED=false the checkout/portal/cancel/verify
   * routes answer 404 — plan limits resolve to generous static values in
   * SubscriptionService, so gameplay is unaffected.
   */
  private assertBillingEnabled(): void {
    if (String(this.config.get<string>('BILLING_ENABLED', 'false')) !== 'true') {
      throw new NotFoundException(
        'Billing is not available on this deployment (payments stay disabled by default).',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get current subscription' })
  async getSubscription(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.getOrCreateSubscription(user.sub, user.email);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create checkout session' })
  async createCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { plan: 'monthly' | 'yearly' },
  ) {
    this.assertBillingEnabled();
    const url = await this.subscriptionService.createCheckoutSession(
      user.sub,
      user.email,
      body.plan,
    );
    return { url };
  }

  @Post('portal')
  @ApiOperation({ summary: 'Create billing portal session' })
  async createPortal(@CurrentUser() user: JwtPayload) {
    this.assertBillingEnabled();
    const url = await this.subscriptionService.createPortalSession(user.sub, user.email);
    return { url };
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancel(@CurrentUser() user: JwtPayload) {
    this.assertBillingEnabled();
    await this.subscriptionService.cancelSubscription(user.sub);
    return { message: 'Subscription will be canceled at period end' };
  }

  @Get('verify-session')
  @ApiOperation({ summary: 'Verify checkout session' })
  async verifySession(@Query('session_id') sessionId: string) {
    this.assertBillingEnabled();
    return this.subscriptionService.verifyCheckoutSession(sessionId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage for all features' })
  async getUsage(@CurrentUser() user: JwtPayload) {
    const usage: Record<string, { allowed: boolean; remaining: number }> = {};

    for (const feature of METERED_FEATURES) {
      usage[feature] = await this.subscriptionService.checkUsage(user.sub, feature);
    }

    return usage;
  }
}
