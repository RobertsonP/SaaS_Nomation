# Phase 3: Comprehensive Technical Planning - COMPLETE
Date: 2025-12-27
Status: ✅ Planning Complete - Ready for GEMINI Implementation

## Problem
User needed extremely detailed technical plans for all remaining Phase 3 tasks to enable new Claude (Brain/Planner) + GEMINI (Executor/Implementer) workflow. Previous plan lacked the "cruelly technical" depth required for smooth handoff between planning and implementation teams.

## Investigation
Reviewed three critical files:
1. `GEMINI.PARTNER.md` - GEMINI team's working protocols and responsibilities
2. `MASTER_PARALLEL_WORK_PLAN.md` - Current project status and remaining tasks
3. `CLAUDE.local.md` - Claude team's 9 specialist roles and quality standards

**Current State Found:**
- Phase 0: ✅ Complete (testing infrastructure, design system)
- Phase 1: ✅ Complete (queues, video, onboarding, production)
- Phase 2: ✅ Mostly complete (G2.1, G2.2, G2.3 done; C2.2 just finished)
- **Phase 3: ❌ Not started** - 4 major tasks remaining:
  - C3.1: Multi-Tenancy & Teams
  - C3.2: Stripe Integration
  - G3.1: Professional Reporting
  - G3.2: Settings & Administration

**Gap Analysis:**
Existing plan had high-level descriptions but lacked:
- Complete database schema specifications
- Authorization/security implementation details
- Full code examples for complex integrations
- Step-by-step migration strategies
- Detailed testing and verification checklists

## Changes Made

### File Created: `/home/robus/.claude/plans/jaunty-wiggling-galaxy.md`

**Comprehensive 1435-line technical analysis covering:**

#### C3.1: Multi-Tenancy & Teams (HIGH Complexity - CRITICAL Security)
- **Executive Summary**: 2-3 day task, critical security implications, foundation for all other Phase 3 work
- **Database Schema Design**:
  - New models: Organization, OrganizationMember, OrganizationInvite
  - Modified models: Project (organizationId instead of userId), User (memberships)
  - Complete Prisma schema with indexes and relations
- **RBAC Permission Matrix**:
  - 4 roles: Owner > Admin > Member > Viewer
  - 15+ permission rules across organization/project/test operations
- **Authorization Middleware**:
  - OrganizationGuard implementation with role hierarchy enforcement
  - Decorators: @RequireRole(), @CurrentOrg()
  - Complete TypeScript code with error handling
- **Migration Strategy**:
  - 4-phase migration: Create personal orgs → Update users → Migrate projects → Verify
  - Full TypeScript migration script (60+ lines)
  - Backup and rollback procedures
- **API Endpoints**: 12 endpoints for organization/member/invite management
- **Testing Strategy**: Unit tests, integration tests, manual testing checklist

#### C3.2: Stripe Integration (MEDIUM-HIGH Complexity)
- **Executive Summary**: 2-3 day task, high risk (payment processing), requires Stripe account setup
- **Stripe Architecture**:
  - Objects: Customer, Product, Price, Subscription, PaymentMethod, Invoice, Webhook
  - Pricing tiers: Free ($0, 100 exec/mo) → Pro ($99, 1000 exec/mo) → Enterprise (custom)
- **Subscription Management Service**:
  - Complete BillingService implementation (150+ lines)
  - Methods: subscribeToPlan(), cancelSubscription(), updatePaymentMethod()
  - Full error handling and status tracking
- **Usage Tracking & Enforcement**:
  - UsageTrackerService with monthly limit checking
  - Execution blocking when limits reached
  - Real-time usage statistics API
- **Webhook Handler**:
  - Event types: subscription.created/updated/deleted, payment.succeeded/failed
  - Full webhook verification and processing logic
  - Database synchronization on subscription changes
- **Frontend Requirements**: Stripe Elements integration, plan selector, usage charts, payment forms

#### G3.1: Professional Reporting (MEDIUM Complexity)
- **PDF Generation**: Puppeteer-based HTML→PDF with Handlebars templates
- **Email Notifications**: nodemailer setup with test failure alerts and weekly digests
- **Report Types**: Execution reports, suite summaries, weekly digests, failure analysis
- **Frontend UI**: Report preview, email settings, scheduled delivery

#### G3.2: Settings & Administration (MEDIUM Complexity)
- **Settings Pages**: Organization, Team, Billing, Notifications, Profile
- **Navigation Structure**: Sidebar layout with 5 main sections
- **Frontend Requirements**: Complete settings interface for GEMINI implementation

### Workflow Implementation Guide
Defined 6-step process for each Phase 3 task:
1. Claude creates technical plan (1-2 hours) - ✅ COMPLETE
2. GEMINI reviews & asks questions (30 mins - 1 hour) - ⏳ NEXT
3. Claude refines plan (30 mins)
4. GEMINI implements (1-3 days)
5. Claude reviews implementation (1-2 hours)
6. Both teams update master plan (15 mins)

### Priority & Sequencing
**Critical Path**: C3.1 → C3.2 → G3.2 → G3.1

**Reasoning**:
- C3.1 (Multi-Tenancy) MUST be first - foundation for organizations, billing, settings
- C3.2 (Stripe) requires organization structure from C3.1
- G3.2 (Settings) requires both org and billing context
- G3.1 (Reporting) can be last, least dependent

### Definition of Done
Created comprehensive checklists for each phase:
- **Planning Phase (Claude)**: Technical analysis, architecture decisions, code examples, GEMINI approval
- **Implementation Phase (GEMINI)**: Files created, features working, tests passing, session notes
- **Review Phase (Claude)**: Code quality, security check, performance verification, production approval

## Implementation Details

### Complete Code Examples Provided:

**Organization Guard (C3.1)**:
```typescript
@Injectable()
export class OrganizationGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<string>('role', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.organizationId || request.body.organizationId;

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } }
    });

    const roleHierarchy = { owner: 4, admin: 3, member: 2, viewer: 1 };
    const userRoleLevel = roleHierarchy[membership.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      throw new ForbiddenException(`Requires ${requiredRole} role or higher`);
    }

    request.organization = await this.prisma.organization.findUnique({ where: { id: orgId } });
    return true;
  }
}
```

**Migration Script (C3.1)**:
```typescript
async function migrateToOrganizations() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const org = await prisma.organization.create({
      data: {
        name: `${user.email}'s Workspace`,
        slug: `user-${user.id.slice(0, 8)}`,
        plan: 'free',
        members: { create: { userId: user.id, role: 'owner' } }
      }
    });
    await prisma.project.updateMany({
      where: { userId: user.id },
      data: { organizationId: org.id, createdBy: user.id }
    });
  }
}
```

**Billing Service (C3.2)**:
```typescript
async subscribeToPlan(organizationId: string, plan: 'pro' | 'enterprise') {
  const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
  const subscription = await this.stripe.createSubscription(org.stripeCustomerId, priceId);
  await this.prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan,
      stripeSubscriptionId: subscription.id,
      maxUsers: plan === 'pro' ? 10 : 999,
      maxExecutions: plan === 'pro' ? 1000 : 999999
    }
  });
}
```

**Usage Tracker (C3.2)**:
```typescript
async trackExecution(organizationId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const executionsThisMonth = await this.prisma.testExecution.count({
    where: {
      test: { project: { organizationId } },
      createdAt: { gte: startOfMonth }
    }
  });
  if (executionsThisMonth >= org.maxExecutions) {
    throw new ForbiddenException(`Monthly execution limit reached`);
  }
}
```

## Testing
**Plan Verification**: ✅ Complete
- All 4 Phase 3 tasks have detailed technical breakdowns
- Database schemas specified with complete Prisma models
- Authorization logic designed with RBAC matrix
- Stripe integration architected with webhook handling
- Migration strategy defined with rollback procedures
- Testing checklists created for each task

**No Compilation**: N/A - This was planning work, no code executed

**Plan Approval**: ✅ Approved by user
- User triggered "PARTNER ACTIVATE" protocol
- Plan created in plan mode
- Plan approved and exited successfully
- Ready for GEMINI team review

## Result

✅ **Phase 3 Planning - COMPLETE**

**Deliverable**: 1435-line comprehensive technical plan covering all Phase 3 tasks

**What GEMINI Squad Receives**:
1. Complete database schema specifications (Prisma models with all fields, relations, indexes)
2. Full authorization/security implementation (OrganizationGuard with role hierarchy)
3. Migration strategy with executable TypeScript code
4. Stripe integration architecture with subscription management
5. Usage tracking and limit enforcement logic
6. API endpoint specifications (12+ endpoints)
7. Testing strategies and verification checklists
8. Priority sequencing: C3.1 → C3.2 → G3.2 → G3.1

**Business Impact**:
- Enables multi-tenant SaaS architecture (security, data isolation)
- Unlocks revenue with Stripe integration ($0 → $99 → custom pricing)
- Provides enterprise-ready team collaboration features
- Creates path to $1,000 MRR (Monthly Recurring Revenue) goal

**Estimated Timeline**: 8-12 days (2-3 weeks with reviews/testing/iterations)

## Next Steps

**Immediate** (GEMINI Team - 30 mins to 1 hour):
1. ✅ Review comprehensive plan document: `/home/robus/.claude/plans/jaunty-wiggling-galaxy.md`
2. ⏳ Ask clarifying questions about architecture, implementation approach, or technical details
3. ⏳ Flag any concerns or suggest better approaches
4. ⏳ Confirm understanding of all components

**After GEMINI Review** (Claude - 30 mins):
1. ⏳ Refine plan based on GEMINI feedback
2. ⏳ Resolve any ambiguities or questions
3. ⏳ Get mutual agreement on final approach

**Implementation Phase** (GEMINI - 2-3 days):
1. ⏳ Begin with C3.1: Multi-Tenancy & Teams (MUST DO FIRST)
2. ⏳ Create Prisma models and run migrations
3. ⏳ Implement authorization guards and API endpoints
4. ⏳ Build frontend organization switcher and team management UI
5. ⏳ Test thoroughly with security verification
6. ⏳ Document implementation in session notes

**Review Phase** (Claude - 1-2 hours):
1. ⏳ Review GEMINI's implementation
2. ⏳ Verify code quality, security, and performance
3. ⏳ Approve or request changes
4. ⏳ Update master plan when complete

---

## Files Modified/Created

**Created**:
- `/home/robus/.claude/plans/jaunty-wiggling-galaxy.md` (1435 lines - comprehensive Phase 3 technical plan)
- This session note

**Next Files to Create** (GEMINI Implementation):
- `backend/prisma/schema.prisma` - Add Organization models
- `backend/src/auth/organization.guard.ts` - Authorization guard
- `backend/src/organizations/organizations.service.ts` - Business logic
- `backend/src/billing/billing.service.ts` - Stripe integration
- `frontend/src/components/organizations/OrganizationSwitcher.tsx` - UI
- (Plus 20+ more files specified in plan)

---

## Technical Lessons Learned

1. **New Workflow Efficiency**: Separating Claude (Brain/Planner) from GEMINI (Executor) enables token-efficient, high-quality development
2. **Plan Detail Matters**: "Cruelly technical" planning eliminates ambiguity, speeds implementation, reduces rework
3. **Architecture First**: Multi-tenancy MUST be foundation - cannot bolt on later without major refactoring
4. **Security Critical**: RBAC and data isolation are not optional for SaaS products - must be core architecture
5. **Migration Strategy**: Converting existing user-owned data to org-owned requires careful planning and rollback procedures
6. **Stripe Webhooks Essential**: Real-time subscription updates prevent billing/access mismatches
7. **Usage Tracking Non-Negotiable**: Enforce limits BEFORE execution, not after - prevents abuse and overages

---

**PLANNING PHASE COMPLETE - READY FOR GEMINI HANDOFF** ✅
