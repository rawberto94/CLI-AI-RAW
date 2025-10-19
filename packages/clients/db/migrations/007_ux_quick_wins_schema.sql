-- Migration: UX Quick Wins Schema
-- Description: Add tables for user preferences, onboarding, progress tracking, and help analytics
-- Date: 2025-01-18

-- UserPreferences table
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "goals" JSONB NOT NULL DEFAULT '[]',
    "dashboardLayout" JSONB,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "notifications" JSONB NOT NULL DEFAULT '{}',
    "onboardingState" JSONB,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "helpToursCompleted" JSONB NOT NULL DEFAULT '[]',
    "customSettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- OnboardingAnalytics table
CREATE TABLE "OnboardingAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timeSpent" INTEGER,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAnalytics_pkey" PRIMARY KEY ("id")
);

-- ProgressEvent table
CREATE TABLE "ProgressEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "details" TEXT,
    "error" TEXT,
    "estimatedTime" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressEvent_pkey" PRIMARY KEY ("id")
);

-- BackgroundJob table
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- HelpAnalytics table
CREATE TABLE "HelpAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT,
    "stepId" TEXT,
    "contentId" TEXT,
    "action" TEXT NOT NULL,
    "query" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpAnalytics_pkey" PRIMARY KEY ("id")
);

-- WidgetAnalytics table
CREATE TABLE "WidgetAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "duration" INTEGER,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetAnalytics_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- Create indexes for UserPreferences
CREATE INDEX "UserPreferences_userId_idx" ON "UserPreferences"("userId");

-- Create indexes for OnboardingAnalytics
CREATE INDEX "OnboardingAnalytics_userId_idx" ON "OnboardingAnalytics"("userId");
CREATE INDEX "OnboardingAnalytics_stepId_idx" ON "OnboardingAnalytics"("stepId");
CREATE INDEX "OnboardingAnalytics_timestamp_idx" ON "OnboardingAnalytics"("timestamp");

-- Create indexes for ProgressEvent
CREATE INDEX "ProgressEvent_jobId_idx" ON "ProgressEvent"("jobId");
CREATE INDEX "ProgressEvent_jobId_timestamp_idx" ON "ProgressEvent"("jobId", "timestamp");

-- Create indexes for BackgroundJob
CREATE INDEX "BackgroundJob_userId_idx" ON "BackgroundJob"("userId");
CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");
CREATE INDEX "BackgroundJob_userId_status_idx" ON "BackgroundJob"("userId", "status");

-- Create indexes for HelpAnalytics
CREATE INDEX "HelpAnalytics_userId_idx" ON "HelpAnalytics"("userId");
CREATE INDEX "HelpAnalytics_tourId_idx" ON "HelpAnalytics"("tourId");
CREATE INDEX "HelpAnalytics_action_idx" ON "HelpAnalytics"("action");
CREATE INDEX "HelpAnalytics_timestamp_idx" ON "HelpAnalytics"("timestamp");

-- Create indexes for WidgetAnalytics
CREATE INDEX "WidgetAnalytics_userId_idx" ON "WidgetAnalytics"("userId");
CREATE INDEX "WidgetAnalytics_widgetType_idx" ON "WidgetAnalytics"("widgetType");
CREATE INDEX "WidgetAnalytics_timestamp_idx" ON "WidgetAnalytics"("timestamp");

-- Add foreign key constraints
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingAnalytics" ADD CONSTRAINT "OnboardingAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpAnalytics" ADD CONSTRAINT "HelpAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetAnalytics" ADD CONSTRAINT "WidgetAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
