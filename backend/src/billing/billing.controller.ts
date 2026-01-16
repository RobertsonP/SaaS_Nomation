import { Controller, Post, Body, UseGuards, Request, Headers, Req, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard, RequireRole } from '../auth/guards/organization.guard';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @RequireRole('admin')
  async createCheckoutSession(
    @Request() req,
    @Body() body: { priceId: string; organizationId: string }
  ) {
    return this.billingService.createCheckoutSession(req.organization.id, req.user.id, body.priceId);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @RequireRole('admin')
  async createPortalSession(
    @Request() req,
    @Body() body: { organizationId: string }
  ) {
    return this.billingService.createPortalSession(req.organization.id);
  }

  @Post('webhook')
  async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: any) {
    // Note: Request body must be raw buffer for signature verification
    // This usually requires disabling body parsing middleware for this route
    // For now, assuming rawBody is available or configured
    if (!signature) throw new BadRequestException('Missing signature');
    return this.billingService.handleWebhook(signature, req.rawBody || req.body);
  }
}
