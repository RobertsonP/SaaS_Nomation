import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
      apiVersion: '2023-10-16', // Fixed version
    });
  }

  async createCheckoutSession(organizationId: string, userId: string, priceId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new BadRequestException('Organization not found');

    // Create or retrieve Stripe Customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      // Get user email for customer creation
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      
      const customer = await this.stripe.customers.create({
        email: user?.email,
        metadata: {
          organizationId: org.id,
        },
      });
      customerId = customer.id;
      
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create Checkout Session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CORS_ORIGIN}/organization/settings?success=true`,
      cancel_url: `${process.env.CORS_ORIGIN}/organization/settings?canceled=true`,
      metadata: {
        organizationId: org.id,
      },
    });

    return { url: session.url };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) return;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        stripeSubscriptionId: session.subscription as string,
        subscriptionStatus: 'active',
        plan: 'pro', // Assume 'pro' for now, logic can be complex
      },
    });
    this.logger.log(`Subscription activated for Org ${organizationId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    
    // Find org by customer ID
    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!org) {
      this.logger.warn(`Organization not found for customer ${customerId}`);
      return;
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
    this.logger.log(`Subscription updated for Org ${org.id}: ${subscription.status}`);
  }

  async createPortalSession(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || !org.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.CORS_ORIGIN}/organization/settings`,
    });

    return { url: session.url };
  }
}
