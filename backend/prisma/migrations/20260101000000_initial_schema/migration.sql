-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT DEFAULT 'inactive',
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "maxExecutions" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "organizationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_urls" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "analysisDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "project_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "startingUrl" TEXT NOT NULL,
    "authFlowId" TEXT,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_executions" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "results" JSONB,
    "errorMsg" TEXT,
    "testId" TEXT NOT NULL,
    "logs" JSONB,
    "metrics" JSONB,
    "screenshots" JSONB,
    "videoPath" TEXT,
    "videoThumbnail" TEXT,

    CONSTRAINT "test_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_elements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "elementType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authFlowId" TEXT,
    "boundingRect" JSONB,
    "category" TEXT,
    "cssInfo" JSONB,
    "discoveryState" TEXT,
    "discoveryTrigger" TEXT,
    "group" TEXT,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "isModal" BOOLEAN NOT NULL DEFAULT false,
    "pageStateId" TEXT,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "sourcePageTitle" TEXT,
    "sourceUrlId" TEXT,
    "sourceUrlPath" TEXT,
    "screenshot" TEXT,
    "accessibilityScore" DOUBLE PRECISION,
    "fallbackSelectors" TEXT[],
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "lastValidated" TIMESTAMP(3),
    "overallQuality" DOUBLE PRECISION,
    "qualityMetrics" JSONB,
    "specificityScore" DOUBLE PRECISION,
    "stabilityScore" DOUBLE PRECISION,
    "uniquenessScore" DOUBLE PRECISION,
    "validationErrors" TEXT[],

    CONSTRAINT "project_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "credentials" JSONB NOT NULL,
    "useAutoDetection" BOOLEAN NOT NULL DEFAULT true,
    "manualSelectors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "auth_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_states" (
    "id" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "trigger" TEXT,
    "url" TEXT NOT NULL,
    "pageTitle" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authFlowId" TEXT,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "page_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "currentState" TEXT NOT NULL DEFAULT 'initial',
    "currentUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "authFlowId" TEXT,

    CONSTRAINT "browser_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selector_quality_history" (
    "id" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "uniquenessScore" DOUBLE PRECISION NOT NULL,
    "stabilityScore" DOUBLE PRECISION NOT NULL,
    "accessibilityScore" DOUBLE PRECISION NOT NULL,
    "specificityScore" DOUBLE PRECISION NOT NULL,
    "overallQuality" DOUBLE PRECISION NOT NULL,
    "matchCount" INTEGER NOT NULL,
    "testResults" JSONB,
    "validationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elementId" TEXT NOT NULL,

    CONSTRAINT "selector_quality_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "css_preview_performance" (
    "id" TEXT NOT NULL,
    "elementCount" INTEGER NOT NULL,
    "extractionTimeMs" INTEGER NOT NULL,
    "renderingTimeMs" INTEGER,
    "totalTimeMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "css_preview_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_page_validations" (
    "id" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "totalUrls" INTEGER NOT NULL,
    "validUrls" INTEGER NOT NULL,
    "uniqueOnAllPages" BOOLEAN NOT NULL,
    "averageMatchCount" DOUBLE PRECISION NOT NULL,
    "inconsistentPages" TEXT[],
    "validationErrors" TEXT[],
    "overallScore" DOUBLE PRECISION NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "cross_page_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suite_tests" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_suite_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suite_executions" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "results" JSONB,
    "errorMsg" TEXT,
    "suiteId" TEXT NOT NULL,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "passedTests" INTEGER NOT NULL DEFAULT 0,
    "failedTests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_suite_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invites_token_key" ON "organization_invites"("token");

-- CreateIndex
CREATE INDEX "organization_invites_email_idx" ON "organization_invites"("email");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- CreateIndex
CREATE INDEX "project_urls_projectId_idx" ON "project_urls"("projectId");

-- CreateIndex
CREATE INDEX "project_urls_projectId_analyzed_idx" ON "project_urls"("projectId", "analyzed");

-- CreateIndex
CREATE INDEX "tests_projectId_idx" ON "tests"("projectId");

-- CreateIndex
CREATE INDEX "test_executions_testId_idx" ON "test_executions"("testId");

-- CreateIndex
CREATE INDEX "test_executions_testId_startedAt_idx" ON "test_executions"("testId", "startedAt");

-- CreateIndex
CREATE INDEX "test_executions_status_idx" ON "test_executions"("status");

-- CreateIndex
CREATE INDEX "project_elements_authFlowId_idx" ON "project_elements"("authFlowId");

-- CreateIndex
CREATE INDEX "project_elements_pageStateId_idx" ON "project_elements"("pageStateId");

-- CreateIndex
CREATE INDEX "project_elements_sourceUrlId_idx" ON "project_elements"("sourceUrlId");

-- CreateIndex
CREATE INDEX "project_elements_projectId_confidence_idx" ON "project_elements"("projectId", "confidence");

-- CreateIndex
CREATE INDEX "project_elements_projectId_discoveryState_idx" ON "project_elements"("projectId", "discoveryState");

-- CreateIndex
CREATE UNIQUE INDEX "project_elements_projectId_selector_sourceUrlId_discoverySt_key" ON "project_elements"("projectId", "selector", "sourceUrlId", "discoveryState");

-- CreateIndex
CREATE INDEX "auth_flows_projectId_idx" ON "auth_flows"("projectId");

-- CreateIndex
CREATE INDEX "page_states_projectId_idx" ON "page_states"("projectId");

-- CreateIndex
CREATE INDEX "page_states_authFlowId_idx" ON "page_states"("authFlowId");

-- CreateIndex
CREATE UNIQUE INDEX "browser_sessions_sessionToken_key" ON "browser_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "browser_sessions_projectId_idx" ON "browser_sessions"("projectId");

-- CreateIndex
CREATE INDEX "browser_sessions_authFlowId_idx" ON "browser_sessions"("authFlowId");

-- CreateIndex
CREATE INDEX "selector_quality_history_elementId_validationDate_idx" ON "selector_quality_history"("elementId", "validationDate");

-- CreateIndex
CREATE INDEX "css_preview_performance_projectId_createdAt_idx" ON "css_preview_performance"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "cross_page_validations_projectId_selector_validatedAt_idx" ON "cross_page_validations"("projectId", "selector", "validatedAt");

-- CreateIndex
CREATE INDEX "test_suites_projectId_idx" ON "test_suites"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "test_suite_tests_suiteId_testId_key" ON "test_suite_tests"("suiteId", "testId");

-- CreateIndex
CREATE INDEX "test_suite_executions_suiteId_idx" ON "test_suite_executions"("suiteId");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_urls" ADD CONSTRAINT "project_urls_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_authFlowId_fkey" FOREIGN KEY ("authFlowId") REFERENCES "auth_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_elements" ADD CONSTRAINT "project_elements_authFlowId_fkey" FOREIGN KEY ("authFlowId") REFERENCES "auth_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_elements" ADD CONSTRAINT "project_elements_pageStateId_fkey" FOREIGN KEY ("pageStateId") REFERENCES "page_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_elements" ADD CONSTRAINT "project_elements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_elements" ADD CONSTRAINT "project_elements_sourceUrlId_fkey" FOREIGN KEY ("sourceUrlId") REFERENCES "project_urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_flows" ADD CONSTRAINT "auth_flows_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_states" ADD CONSTRAINT "page_states_authFlowId_fkey" FOREIGN KEY ("authFlowId") REFERENCES "auth_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_states" ADD CONSTRAINT "page_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_authFlowId_fkey" FOREIGN KEY ("authFlowId") REFERENCES "auth_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selector_quality_history" ADD CONSTRAINT "selector_quality_history_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "project_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "css_preview_performance" ADD CONSTRAINT "css_preview_performance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_page_validations" ADD CONSTRAINT "cross_page_validations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_tests" ADD CONSTRAINT "test_suite_tests_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_tests" ADD CONSTRAINT "test_suite_tests_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_executions" ADD CONSTRAINT "test_suite_executions_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
