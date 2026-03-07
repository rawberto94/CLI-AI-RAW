-- CreateTable
CREATE TABLE "contract_drafts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MSA',
    "sourceType" TEXT NOT NULL DEFAULT 'NEW',
    "sourceContractId" TEXT,
    "content" TEXT,
    "clauses" JSONB NOT NULL DEFAULT '[]',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "structure" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "estimatedValue" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "proposedStartDate" TIMESTAMP(3),
    "proposedEndDate" TIMESTAMP(3),
    "externalParties" JSONB NOT NULL DEFAULT '[]',
    "aiPrompt" TEXT,
    "aiModel" TEXT,
    "generationParams" JSONB DEFAULT '{}',
    "currentStep" TEXT,
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "approvalWorkflow" JSONB DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "context" TEXT,
    "contextType" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "processingTime" INTEGER,
    "confidence" DOUBLE PRECISION,
    "sources" JSONB DEFAULT '[]',
    "suggestions" JSONB DEFAULT '[]',
    "feedback" TEXT,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "subject" TEXT,
    "message" TEXT,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligation_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_drafts_tenantId_idx" ON "contract_drafts"("tenantId");

-- CreateIndex
CREATE INDEX "contract_drafts_templateId_idx" ON "contract_drafts"("templateId");

-- CreateIndex
CREATE INDEX "contract_drafts_status_idx" ON "contract_drafts"("status");

-- CreateIndex
CREATE INDEX "contract_drafts_type_idx" ON "contract_drafts"("type");

-- CreateIndex
CREATE INDEX "contract_drafts_sourceType_idx" ON "contract_drafts"("sourceType");

-- CreateIndex
CREATE INDEX "contract_drafts_tenantId_status_idx" ON "contract_drafts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "contract_drafts_tenantId_type_idx" ON "contract_drafts"("tenantId", "type");

-- CreateIndex
CREATE INDEX "contract_drafts_createdAt_idx" ON "contract_drafts"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_conversations_tenantId_idx" ON "chat_conversations"("tenantId");

-- CreateIndex
CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");

-- CreateIndex
CREATE INDEX "chat_conversations_tenantId_userId_idx" ON "chat_conversations"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "chat_conversations_contextType_idx" ON "chat_conversations"("contextType");

-- CreateIndex
CREATE INDEX "chat_conversations_createdAt_idx" ON "chat_conversations"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- CreateIndex
CREATE INDEX "chat_messages_role_idx" ON "chat_messages"("role");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "obligation_notifications_tenantId_idx" ON "obligation_notifications"("tenantId");

-- CreateIndex
CREATE INDEX "obligation_notifications_contractId_idx" ON "obligation_notifications"("contractId");

-- CreateIndex
CREATE INDEX "obligation_notifications_status_idx" ON "obligation_notifications"("status");

-- CreateIndex
CREATE INDEX "obligation_notifications_scheduledFor_idx" ON "obligation_notifications"("scheduledFor");

-- CreateIndex
CREATE INDEX "obligation_notifications_tenantId_status_idx" ON "obligation_notifications"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "contract_drafts" ADD CONSTRAINT "contract_drafts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_drafts" ADD CONSTRAINT "contract_drafts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_drafts" ADD CONSTRAINT "contract_drafts_sourceContractId_fkey" FOREIGN KEY ("sourceContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_drafts" ADD CONSTRAINT "contract_drafts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_notifications" ADD CONSTRAINT "obligation_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
