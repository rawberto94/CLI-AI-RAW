# Design Document

## Overview

The UX Quick Wins feature transforms Chain IQ from a functionally complete platform into a user-friendly, intuitive system that guides users to value quickly. This design addresses the four highest-impact UX improvements identified in the requirements: guided onboarding, smart dashboard personalization, enhanced progress feedback, and contextual help.

The design leverages existing components (OnboardingWizard, MultiStageProgress, GlobalCommandPalette) while extending them with new capabilities. It introduces a user preferences system to store personalization data, integrates real-time progress tracking via WebSockets, and implements a comprehensive help content management system.

### Design Principles

1. **Progressive Disclosure**: Show users what they need when they need it, not everything at once
2. **Personalization**: Adapt the experience based on user role, behavior, and preferences
3. **Feedback Loops**: Provide continuous, detailed feedback on system operations
4. **Discoverability**: Make features easy to find through contextual help and guided tours
5. **Non-Intrusive**: Help should be available but never blocking or annoying
6. **Performance**: All UX enhancements must maintain sub-second response times
7. **Accessibility**: WCAG 2.1 AA compliance for all interactive elements

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Onboarding  │  │  Dashboard   │  │   Progress   │     │
│  │   Wizard     │  │Personalization│  │   Tracker    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Contextual   │  │   Command    │  │   Help       │     │
│  │    Help      │  │   Palette    │  │   Center     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
├─────────────────────────────────────────────────────────────┤
│  /api/user/preferences  │  /api/user/onboarding            │
│  /api/dashboard/layout  │  /api/progress/stream            │
│  /api/help/content      │  /api/help/tours                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│  UserPreferencesService │  OnboardingService               │
│  DashboardService       │  ProgressTrackingService         │
│  HelpContentService     │  AnalyticsService                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│  UserPreferences Table  │  OnboardingProgress Table        │
│  DashboardLayouts Table │  HelpContent CMS/Files           │
│  UserAnalytics Table    │  ProgressEvents (WebSocket)      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18, Next.js 14, TypeScript, Tailwind CSS
- **State Management**: React Context + Hooks, Zustand for complex state
- **Real-time**: WebSocket (Socket.io) or Server-Sent Events
- **Animations**: Framer Motion (already in use)
- **UI Components**: Radix UI primitives (already in use)
- **Backend**: Next.js API Routes, Node.js services
- **Database**: PostgreSQL (existing), Prisma ORM
- **Help Content**: Markdown files or headless CMS (Contentful/Sanity)


## Components and Interfaces

### 1. Guided Onboarding Flow

#### Component Structure

```typescript
// apps/web/components/onboarding/EnhancedOnboardingWizard.tsx

interface OnboardingState {
  currentStep: number
  completed: boolean
  skipped: boolean
  userData: {
    role?: UserRole
    name?: string
    company?: string
    goals?: string[]
    preferences?: {
      dashboardLayout?: string
      notifications?: boolean
      theme?: 'light' | 'dark'
    }
  }
  progress: {
    [stepId: string]: {
      completed: boolean
      skipped: boolean
      data?: any
    }
  }
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ComponentType
  component: React.ComponentType<OnboardingStepProps>
  optional?: boolean
  estimatedTime?: number // in seconds
  dependencies?: string[] // step IDs that must be completed first
}

interface OnboardingStepProps {
  onNext: (data?: any) => void
  onSkip: () => void
  onBack: () => void
  data: Record<string, any>
  state: OnboardingState
}
```

#### Database Schema Extension

```prisma
// Add to packages/clients/db/schema.prisma

model UserPreferences {
  id                String   @id @default(cuid())
  userId            String   @unique
  role              String?  // procurement-manager, analyst, executive, etc.
  goals             Json     @default("[]") // Array of goal IDs
  dashboardLayout   Json?    // Widget configuration
  theme             String   @default("light")
  notifications     Json     @default("{}")
  onboardingState   Json?    // Current onboarding progress
  onboardingCompleted Boolean @default(false)
  onboardingSkipped Boolean  @default(false)
  onboardingCompletedAt DateTime?
  helpToursCompleted Json    @default("[]") // Array of completed tour IDs
  customSettings    Json     @default("{}")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model OnboardingAnalytics {
  id                String   @id @default(cuid())
  userId            String
  stepId            String
  action            String   // started, completed, skipped, back
  timeSpent         Int?     // seconds
  metadata          Json?
  timestamp         DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([stepId])
  @@index([timestamp])
}
```

#### API Endpoints

```typescript
// apps/web/app/api/user/onboarding/route.ts

// GET /api/user/onboarding - Get current onboarding state
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId }
  })
  return NextResponse.json({
    success: true,
    data: {
      completed: preferences?.onboardingCompleted || false,
      skipped: preferences?.onboardingSkipped || false,
      state: preferences?.onboardingState || null,
      role: preferences?.role
    }
  })
}

// POST /api/user/onboarding - Update onboarding progress
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  const body = await request.json()
  
  const preferences = await prisma.userPreferences.upsert({
    where: { userId },
    update: {
      onboardingState: body.state,
      role: body.role,
      goals: body.goals,
      onboardingCompleted: body.completed,
      onboardingCompletedAt: body.completed ? new Date() : null
    },
    create: {
      userId,
      onboardingState: body.state,
      role: body.role,
      goals: body.goals
    }
  })
  
  return NextResponse.json({ success: true, data: preferences })
}

// POST /api/user/onboarding/skip - Skip onboarding
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  
  await prisma.userPreferences.upsert({
    where: { userId },
    update: { onboardingSkipped: true },
    create: { userId, onboardingSkipped: true }
  })
  
  return NextResponse.json({ success: true })
}
```


### 2. Smart Dashboard Personalization

#### Component Structure

```typescript
// apps/web/components/dashboard/PersonalizedDashboard.tsx

interface DashboardWidget {
  id: string
  type: string // 'upcoming-renewals', 'savings-pipeline', etc.
  title: string
  size: 'small' | 'medium' | 'large' | 'full'
  position: { x: number; y: number; w: number; h: number }
  config?: Record<string, any>
  visible: boolean
  refreshInterval?: number // seconds
}

interface DashboardLayout {
  id: string
  name: string
  widgets: DashboardWidget[]
  isDefault: boolean
  role?: UserRole
}

interface DashboardConfig {
  currentLayoutId: string
  layouts: DashboardLayout[]
  quickActions: QuickAction[]
  aiSuggestions: WidgetSuggestion[]
}

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType
  action: () => void
  badge?: string
  visible: boolean
}

interface WidgetSuggestion {
  widgetType: string
  reason: string
  confidence: number
  priority: number
}
```

#### Role-Based Default Layouts

```typescript
// apps/web/lib/dashboard/default-layouts.ts

export const DEFAULT_LAYOUTS: Record<UserRole, DashboardLayout> = {
  'procurement-manager': {
    id: 'procurement-manager-default',
    name: 'Procurement Manager View',
    isDefault: true,
    role: 'procurement-manager',
    widgets: [
      {
        id: 'upcoming-renewals',
        type: 'upcoming-renewals',
        title: 'Upcoming Renewals',
        size: 'large',
        position: { x: 0, y: 0, w: 8, h: 4 },
        visible: true,
        refreshInterval: 300
      },
      {
        id: 'savings-pipeline',
        type: 'savings-pipeline',
        title: 'Savings Pipeline',
        size: 'medium',
        position: { x: 8, y: 0, w: 4, h: 4 },
        visible: true
      },
      {
        id: 'supplier-performance',
        type: 'supplier-performance',
        title: 'Supplier Performance',
        size: 'medium',
        position: { x: 0, y: 4, w: 6, h: 4 },
        visible: true
      },
      {
        id: 'contract-status',
        type: 'contract-status',
        title: 'Contract Status',
        size: 'medium',
        position: { x: 6, y: 4, w: 6, h: 4 },
        visible: true
      }
    ]
  },
  'analyst': {
    id: 'analyst-default',
    name: 'Analyst View',
    isDefault: true,
    role: 'analyst',
    widgets: [
      {
        id: 'spend-analysis',
        type: 'spend-analysis',
        title: 'Spend Analysis',
        size: 'large',
        position: { x: 0, y: 0, w: 8, h: 4 },
        visible: true
      },
      {
        id: 'rate-benchmarking',
        type: 'rate-benchmarking',
        title: 'Rate Benchmarking',
        size: 'medium',
        position: { x: 8, y: 0, w: 4, h: 4 },
        visible: true
      },
      {
        id: 'data-quality',
        type: 'data-quality',
        title: 'Data Quality',
        size: 'medium',
        position: { x: 0, y: 4, w: 6, h: 4 },
        visible: true
      },
      {
        id: 'recent-uploads',
        type: 'recent-uploads',
        title: 'Recent Uploads',
        size: 'medium',
        position: { x: 6, y: 4, w: 6, h: 4 },
        visible: true
      }
    ]
  },
  'executive': {
    id: 'executive-default',
    name: 'Executive View',
    isDefault: true,
    role: 'executive',
    widgets: [
      {
        id: 'roi-summary',
        type: 'roi-summary',
        title: 'ROI Summary',
        size: 'large',
        position: { x: 0, y: 0, w: 6, h: 4 },
        visible: true
      },
      {
        id: 'savings-realized',
        type: 'savings-realized',
        title: 'Savings Realized',
        size: 'medium',
        position: { x: 6, y: 0, w: 6, h: 4 },
        visible: true
      },
      {
        id: 'portfolio-health',
        type: 'portfolio-health',
        title: 'Portfolio Health',
        size: 'medium',
        position: { x: 0, y: 4, w: 6, h: 4 },
        visible: true
      },
      {
        id: 'key-metrics',
        type: 'key-metrics',
        title: 'Key Metrics',
        size: 'medium',
        position: { x: 6, y: 4, w: 6, h: 4 },
        visible: true
      }
    ]
  }
}
```

#### AI-Powered Widget Suggestions

```typescript
// apps/web/lib/dashboard/widget-suggestions.ts

interface UserActivity {
  userId: string
  action: string
  resource: string
  timestamp: Date
  metadata?: Record<string, any>
}

export class WidgetSuggestionEngine {
  async generateSuggestions(userId: string): Promise<WidgetSuggestion[]> {
    // Get user activity from last 30 days
    const activities = await this.getUserActivities(userId, 30)
    
    const suggestions: WidgetSuggestion[] = []
    
    // Analyze rate card usage
    const rateCardActions = activities.filter(a => 
      a.resource === 'rate-card' || a.action.includes('rate')
    )
    if (rateCardActions.length > 5) {
      suggestions.push({
        widgetType: 'rate-benchmarking',
        reason: 'You frequently work with rate cards',
        confidence: 0.85,
        priority: 1
      })
    }
    
    // Analyze contract uploads
    const uploadActions = activities.filter(a => a.action === 'contract-upload')
    if (uploadActions.length > 10) {
      suggestions.push({
        widgetType: 'upload-queue',
        reason: 'Track your frequent uploads',
        confidence: 0.90,
        priority: 2
      })
    }
    
    // Analyze compliance checks
    const complianceActions = activities.filter(a => 
      a.action.includes('compliance')
    )
    if (complianceActions.length > 3) {
      suggestions.push({
        widgetType: 'compliance-dashboard',
        reason: 'Monitor compliance status',
        confidence: 0.80,
        priority: 3
      })
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority)
  }
  
  private async getUserActivities(
    userId: string, 
    days: number
  ): Promise<UserActivity[]> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    
    return await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    })
  }
}
```

#### API Endpoints

```typescript
// apps/web/app/api/dashboard/layout/route.ts

// GET /api/dashboard/layout - Get user's dashboard layout
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId }
  })
  
  const role = preferences?.role || 'analyst'
  const customLayout = preferences?.dashboardLayout
  
  // Return custom layout if exists, otherwise default for role
  const layout = customLayout || DEFAULT_LAYOUTS[role]
  
  return NextResponse.json({
    success: true,
    data: {
      layout,
      role,
      hasCustomLayout: !!customLayout
    }
  })
}

// POST /api/dashboard/layout - Save custom dashboard layout
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  const body = await request.json()
  
  await prisma.userPreferences.upsert({
    where: { userId },
    update: {
      dashboardLayout: body.layout
    },
    create: {
      userId,
      dashboardLayout: body.layout
    }
  })
  
  return NextResponse.json({ success: true })
}

// GET /api/dashboard/suggestions - Get AI widget suggestions
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  
  const engine = new WidgetSuggestionEngine()
  const suggestions = await engine.generateSuggestions(userId)
  
  return NextResponse.json({
    success: true,
    data: suggestions
  })
}
```


### 3. Enhanced Progress Feedback

#### Component Structure

```typescript
// apps/web/components/progress/EnhancedProgressTracker.tsx

interface ProgressEvent {
  jobId: string
  stage: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  progress: number
  details?: string
  error?: string
  estimatedTime?: number
  timestamp: Date
  metadata?: Record<string, any>
}

interface ProgressSubscription {
  jobId: string
  onUpdate: (event: ProgressEvent) => void
  onComplete: (result: any) => void
  onError: (error: Error) => void
}

interface BackgroundJob {
  id: string
  type: string
  title: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  startedAt: Date
  completedAt?: Date
  result?: any
  error?: string
}
```

#### Real-Time Progress Tracking Service

```typescript
// packages/data-orchestration/src/services/progress-tracking.service.ts

import { EventEmitter } from 'events'
import { Server as SocketIOServer } from 'socket.io'

export class ProgressTrackingService extends EventEmitter {
  private io: SocketIOServer
  private activeJobs: Map<string, ProgressEvent[]> = new Map()
  
  constructor(io: SocketIOServer) {
    super()
    this.io = io
    this.setupSocketHandlers()
  }
  
  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)
      
      // Subscribe to job progress
      socket.on('subscribe:job', (jobId: string) => {
        socket.join(`job:${jobId}`)
        
        // Send current progress if job exists
        const events = this.activeJobs.get(jobId)
        if (events) {
          socket.emit('job:history', events)
        }
      })
      
      // Unsubscribe from job
      socket.on('unsubscribe:job', (jobId: string) => {
        socket.leave(`job:${jobId}`)
      })
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })
  }
  
  // Emit progress update
  async emitProgress(event: ProgressEvent) {
    // Store event
    if (!this.activeJobs.has(event.jobId)) {
      this.activeJobs.set(event.jobId, [])
    }
    this.activeJobs.get(event.jobId)!.push(event)
    
    // Broadcast to subscribed clients
    this.io.to(`job:${event.jobId}`).emit('job:progress', event)
    
    // Store in database for persistence
    await this.storeProgressEvent(event)
    
    // Clean up completed jobs after 1 hour
    if (event.status === 'completed' || event.status === 'failed') {
      setTimeout(() => {
        this.activeJobs.delete(event.jobId)
      }, 3600000)
    }
  }
  
  private async storeProgressEvent(event: ProgressEvent) {
    await prisma.progressEvent.create({
      data: {
        jobId: event.jobId,
        stage: event.stage,
        status: event.status,
        progress: event.progress,
        details: event.details,
        error: event.error,
        estimatedTime: event.estimatedTime,
        metadata: event.metadata || {},
        timestamp: event.timestamp
      }
    })
  }
  
  // Get job progress history
  async getJobProgress(jobId: string): Promise<ProgressEvent[]> {
    // Check memory first
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId)!
    }
    
    // Fall back to database
    const events = await prisma.progressEvent.findMany({
      where: { jobId },
      orderBy: { timestamp: 'asc' }
    })
    
    return events.map(e => ({
      jobId: e.jobId,
      stage: e.stage,
      status: e.status as any,
      progress: e.progress,
      details: e.details || undefined,
      error: e.error || undefined,
      estimatedTime: e.estimatedTime || undefined,
      timestamp: e.timestamp,
      metadata: e.metadata as any
    }))
  }
}

// Integration with contract processing
export class ContractProcessingWithProgress {
  constructor(
    private progressService: ProgressTrackingService
  ) {}
  
  async processContract(contractId: string, jobId: string) {
    const stages = [
      { id: 'validation', name: 'Validating file', estimatedTime: 5 },
      { id: 'upload', name: 'Uploading', estimatedTime: 10 },
      { id: 'extraction', name: 'Extracting text', estimatedTime: 30 },
      { id: 'ai-analysis', name: 'AI analysis', estimatedTime: 45 },
      { id: 'artifacts', name: 'Generating artifacts', estimatedTime: 20 }
    ]
    
    for (const stage of stages) {
      // Start stage
      await this.progressService.emitProgress({
        jobId,
        stage: stage.id,
        status: 'in-progress',
        progress: 0,
        details: `Starting ${stage.name}...`,
        estimatedTime: stage.estimatedTime,
        timestamp: new Date()
      })
      
      // Simulate progress updates
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, stage.estimatedTime * 10))
        
        await this.progressService.emitProgress({
          jobId,
          stage: stage.id,
          status: 'in-progress',
          progress: i,
          details: `${stage.name}: ${i}%`,
          estimatedTime: stage.estimatedTime * (100 - i) / 100,
          timestamp: new Date()
        })
      }
      
      // Complete stage
      await this.progressService.emitProgress({
        jobId,
        stage: stage.id,
        status: 'completed',
        progress: 100,
        details: `✓ ${stage.name} complete`,
        timestamp: new Date()
      })
    }
  }
}
```

#### Database Schema Extension

```prisma
// Add to packages/clients/db/schema.prisma

model ProgressEvent {
  id            String   @id @default(cuid())
  jobId         String
  stage         String
  status        String
  progress      Int
  details       String?
  error         String?
  estimatedTime Int?
  metadata      Json     @default("{}")
  timestamp     DateTime @default(now())
  
  @@index([jobId])
  @@index([jobId, timestamp])
}

model BackgroundJob {
  id          String    @id @default(cuid())
  userId      String
  type        String
  title       String
  status      String
  progress    Int       @default(0)
  result      Json?
  error       String?
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  metadata    Json      @default("{}")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([status])
  @@index([userId, status])
}
```

#### API Endpoints

```typescript
// apps/web/app/api/progress/[jobId]/route.ts

// GET /api/progress/[jobId] - Get job progress
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const progressService = getProgressTrackingService()
  const events = await progressService.getJobProgress(params.jobId)
  
  return NextResponse.json({
    success: true,
    data: events
  })
}

// apps/web/app/api/background-jobs/route.ts

// GET /api/background-jobs - Get user's background jobs
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      userId,
      status: { in: ['running', 'completed'] }
    },
    orderBy: { startedAt: 'desc' },
    take: 10
  })
  
  return NextResponse.json({
    success: true,
    data: jobs
  })
}

// DELETE /api/background-jobs/[id] - Dismiss completed job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromSession(request)
  
  await prisma.backgroundJob.delete({
    where: {
      id: params.id,
      userId // Ensure user owns the job
    }
  })
  
  return NextResponse.json({ success: true })
}
```

#### WebSocket Integration

```typescript
// apps/web/lib/websocket/progress-client.ts

import { io, Socket } from 'socket.io-client'

export class ProgressClient {
  private socket: Socket
  private subscriptions: Map<string, ProgressSubscription> = new Map()
  
  constructor() {
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000', {
      path: '/api/socket',
      transports: ['websocket']
    })
    
    this.setupHandlers()
  }
  
  private setupHandlers() {
    this.socket.on('job:progress', (event: ProgressEvent) => {
      const subscription = this.subscriptions.get(event.jobId)
      if (subscription) {
        subscription.onUpdate(event)
        
        if (event.status === 'completed') {
          subscription.onComplete(event.metadata)
          this.unsubscribe(event.jobId)
        } else if (event.status === 'failed') {
          subscription.onError(new Error(event.error || 'Job failed'))
          this.unsubscribe(event.jobId)
        }
      }
    })
    
    this.socket.on('job:history', (events: ProgressEvent[]) => {
      if (events.length > 0) {
        const jobId = events[0].jobId
        const subscription = this.subscriptions.get(jobId)
        if (subscription) {
          events.forEach(event => subscription.onUpdate(event))
        }
      }
    })
  }
  
  subscribe(subscription: ProgressSubscription) {
    this.subscriptions.set(subscription.jobId, subscription)
    this.socket.emit('subscribe:job', subscription.jobId)
  }
  
  unsubscribe(jobId: string) {
    this.subscriptions.delete(jobId)
    this.socket.emit('unsubscribe:job', jobId)
  }
  
  disconnect() {
    this.socket.disconnect()
  }
}

// React Hook
export function useProgressTracking(jobId: string | null) {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    if (!jobId) return
    
    const client = new ProgressClient()
    
    client.subscribe({
      jobId,
      onUpdate: (event) => {
        setEvents(prev => [...prev, event])
      },
      onComplete: () => {
        setIsComplete(true)
      },
      onError: (err) => {
        setError(err)
      }
    })
    
    return () => {
      client.disconnect()
    }
  }, [jobId])
  
  return { events, isComplete, error }
}
```


### 4. Contextual Help System

#### Component Structure

```typescript
// apps/web/components/help/ContextualHelp.tsx

interface HelpContent {
  id: string
  trigger: string // CSS selector or component ID
  title: string
  content: string
  type: 'tooltip' | 'popover' | 'modal' | 'tour'
  video?: string
  relatedDocs?: string[]
  keywords?: string[]
  category?: string
}

interface InteractiveTour {
  id: string
  name: string
  description: string
  steps: TourStep[]
  estimatedTime: number // minutes
  category: string
  prerequisites?: string[]
}

interface TourStep {
  id: string
  target: string // CSS selector
  title: string
  content: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  action?: 'click' | 'hover' | 'input'
  validation?: () => boolean
  highlightPadding?: number
}

interface HelpSearchResult {
  id: string
  title: string
  excerpt: string
  type: 'article' | 'video' | 'tour' | 'faq'
  url?: string
  relevance: number
}
```

#### Help Content Management

```typescript
// apps/web/lib/help/help-content-manager.ts

export class HelpContentManager {
  private content: Map<string, HelpContent> = new Map()
  private tours: Map<string, InteractiveTour> = new Map()
  
  constructor() {
    this.loadContent()
  }
  
  private async loadContent() {
    // Load from markdown files or CMS
    const contentFiles = await this.loadMarkdownFiles()
    const tourFiles = await this.loadTourDefinitions()
    
    contentFiles.forEach(content => {
      this.content.set(content.id, content)
    })
    
    tourFiles.forEach(tour => {
      this.tours.set(tour.id, tour)
    })
  }
  
  getContentForElement(elementId: string): HelpContent | null {
    return this.content.get(elementId) || null
  }
  
  getTour(tourId: string): InteractiveTour | null {
    return this.tours.get(tourId) || null
  }
  
  search(query: string): HelpSearchResult[] {
    const results: HelpSearchResult[] = []
    const lowerQuery = query.toLowerCase()
    
    // Search help content
    this.content.forEach(content => {
      const titleMatch = content.title.toLowerCase().includes(lowerQuery)
      const contentMatch = content.content.toLowerCase().includes(lowerQuery)
      const keywordMatch = content.keywords?.some(k => 
        k.toLowerCase().includes(lowerQuery)
      )
      
      if (titleMatch || contentMatch || keywordMatch) {
        results.push({
          id: content.id,
          title: content.title,
          excerpt: this.getExcerpt(content.content, query),
          type: 'article',
          relevance: titleMatch ? 1.0 : keywordMatch ? 0.8 : 0.6
        })
      }
    })
    
    // Search tours
    this.tours.forEach(tour => {
      if (tour.name.toLowerCase().includes(lowerQuery) ||
          tour.description.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: tour.id,
          title: tour.name,
          excerpt: tour.description,
          type: 'tour',
          relevance: 0.9
        })
      }
    })
    
    return results.sort((a, b) => b.relevance - a.relevance)
  }
  
  private getExcerpt(content: string, query: string, length: number = 150): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return content.substring(0, length) + '...'
    
    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 100)
    
    return (start > 0 ? '...' : '') + 
           content.substring(start, end) + 
           (end < content.length ? '...' : '')
  }
  
  private async loadMarkdownFiles(): Promise<HelpContent[]> {
    // Load from .kiro/help/*.md files
    const fs = require('fs').promises
    const path = require('path')
    const matter = require('gray-matter')
    
    const helpDir = path.join(process.cwd(), '.kiro', 'help')
    const files = await fs.readdir(helpDir)
    
    const content: HelpContent[] = []
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      
      const filePath = path.join(helpDir, file)
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const { data, content: markdown } = matter(fileContent)
      
      content.push({
        id: data.id || file.replace('.md', ''),
        trigger: data.trigger,
        title: data.title,
        content: markdown,
        type: data.type || 'popover',
        video: data.video,
        relatedDocs: data.relatedDocs || [],
        keywords: data.keywords || [],
        category: data.category
      })
    }
    
    return content
  }
  
  private async loadTourDefinitions(): Promise<InteractiveTour[]> {
    // Load from .kiro/help/tours/*.json files
    const fs = require('fs').promises
    const path = require('path')
    
    const toursDir = path.join(process.cwd(), '.kiro', 'help', 'tours')
    const files = await fs.readdir(toursDir)
    
    const tours: InteractiveTour[] = []
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      
      const filePath = path.join(toursDir, file)
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const tour = JSON.parse(fileContent)
      
      tours.push(tour)
    }
    
    return tours
  }
}
```

#### Interactive Tour Component

```typescript
// apps/web/components/help/InteractiveTour.tsx

import { Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export class TourManager {
  private driver: Driver
  private currentTour: InteractiveTour | null = null
  
  constructor() {
    this.driver = new Driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      allowClose: true,
      overlayClickNext: false,
      doneBtnText: 'Finish',
      closeBtnText: 'Skip',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      onDestroyStarted: () => {
        if (this.currentTour) {
          this.markTourCompleted(this.currentTour.id)
        }
      }
    })
  }
  
  async startTour(tour: InteractiveTour) {
    this.currentTour = tour
    
    const steps = tour.steps.map(step => ({
      element: step.target,
      popover: {
        title: step.title,
        description: step.content,
        position: step.placement
      },
      onHighlightStarted: () => {
        // Track step view
        this.trackTourStep(tour.id, step.id, 'viewed')
      },
      onNext: () => {
        // Validate step if needed
        if (step.validation && !step.validation()) {
          return false
        }
        this.trackTourStep(tour.id, step.id, 'completed')
      }
    }))
    
    this.driver.defineSteps(steps)
    this.driver.start()
  }
  
  stopTour() {
    this.driver.destroy()
    this.currentTour = null
  }
  
  private async markTourCompleted(tourId: string) {
    await fetch('/api/help/tours/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId })
    })
  }
  
  private async trackTourStep(
    tourId: string, 
    stepId: string, 
    action: string
  ) {
    await fetch('/api/help/tours/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId, stepId, action })
    })
  }
}

// React Hook
export function useInteractiveTour(tourId: string) {
  const [manager] = useState(() => new TourManager())
  const [isActive, setIsActive] = useState(false)
  
  const startTour = async () => {
    const response = await fetch(`/api/help/tours/${tourId}`)
    const { data: tour } = await response.json()
    
    if (tour) {
      manager.startTour(tour)
      setIsActive(true)
    }
  }
  
  const stopTour = () => {
    manager.stopTour()
    setIsActive(false)
  }
  
  return { startTour, stopTour, isActive }
}
```

#### Help Content Files Structure

```
.kiro/help/
├── upload-zone.md
├── rate-benchmarking.md
├── compliance-check.md
├── dashboard-customization.md
└── tours/
    ├── first-upload.json
    ├── rate-benchmarking.json
    ├── dashboard-setup.json
    └── compliance-workflow.json
```

Example help content file:

```markdown
---
id: upload-zone
trigger: #upload-zone
title: Upload Contracts
type: popover
video: /help/videos/upload-demo.mp4
keywords: [upload, contract, file, pdf, docx]
category: getting-started
relatedDocs:
  - /docs/supported-formats
  - /docs/file-size-limits
---

# Upload Contracts

Drag and drop contracts here to start AI-powered analysis.

## Supported Formats
- PDF (up to 100MB)
- DOCX (up to 50MB)
- TXT (up to 10MB)

## What Happens Next?
1. File validation (5 seconds)
2. Text extraction (30 seconds)
3. AI analysis (1-2 minutes)
4. Artifact generation (30 seconds)

## Tips
- Upload multiple files at once for batch processing
- Ensure files are text-based (not scanned images)
- Check file names are descriptive for easier organization
```

Example tour definition:

```json
{
  "id": "first-upload",
  "name": "Your First Contract Upload",
  "description": "Learn how to upload and analyze your first contract",
  "estimatedTime": 3,
  "category": "getting-started",
  "steps": [
    {
      "id": "step-1",
      "target": "#upload-zone",
      "title": "Upload Zone",
      "content": "Drag and drop your contract file here, or click to browse.",
      "placement": "bottom",
      "highlightPadding": 10
    },
    {
      "id": "step-2",
      "target": "#file-preview",
      "title": "File Preview",
      "content": "Review file details before uploading. You can edit metadata here.",
      "placement": "right"
    },
    {
      "id": "step-3",
      "target": "#progress-tracker",
      "title": "Progress Tracking",
      "content": "Watch real-time progress as we analyze your contract.",
      "placement": "left"
    },
    {
      "id": "step-4",
      "target": "#insights-panel",
      "title": "AI Insights",
      "content": "View extracted insights, key terms, and risk analysis.",
      "placement": "top"
    }
  ]
}
```

#### API Endpoints

```typescript
// apps/web/app/api/help/content/[id]/route.ts

// GET /api/help/content/[id] - Get help content
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const manager = new HelpContentManager()
  const content = manager.getContentForElement(params.id)
  
  if (!content) {
    return NextResponse.json(
      { error: 'Help content not found' },
      { status: 404 }
    )
  }
  
  return NextResponse.json({
    success: true,
    data: content
  })
}

// apps/web/app/api/help/search/route.ts

// GET /api/help/search?q=query - Search help content
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  
  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter required' },
      { status: 400 }
    )
  }
  
  const manager = new HelpContentManager()
  const results = manager.search(query)
  
  return NextResponse.json({
    success: true,
    data: results
  })
}

// apps/web/app/api/help/tours/[id]/route.ts

// GET /api/help/tours/[id] - Get tour definition
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const manager = new HelpContentManager()
  const tour = manager.getTour(params.id)
  
  if (!tour) {
    return NextResponse.json(
      { error: 'Tour not found' },
      { status: 404 }
    )
  }
  
  return NextResponse.json({
    success: true,
    data: tour
  })
}

// POST /api/help/tours/complete - Mark tour as completed
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  const body = await request.json()
  
  await prisma.userPreferences.update({
    where: { userId },
    data: {
      helpToursCompleted: {
        push: body.tourId
      }
    }
  })
  
  return NextResponse.json({ success: true })
}

// POST /api/help/tours/track - Track tour step interaction
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromSession(request)
  const body = await request.json()
  
  await prisma.helpAnalytics.create({
    data: {
      userId,
      tourId: body.tourId,
      stepId: body.stepId,
      action: body.action,
      timestamp: new Date()
    }
  })
  
  return NextResponse.json({ success: true })
}
```


## Data Models

### Complete Database Schema Extensions

```prisma
// Add to packages/clients/db/schema.prisma

// User Preferences and Personalization
model UserPreferences {
  id                    String    @id @default(cuid())
  userId                String    @unique
  role                  String?   // procurement-manager, analyst, executive, etc.
  goals                 Json      @default("[]")
  dashboardLayout       Json?
  theme                 String    @default("light")
  notifications         Json      @default("{}")
  onboardingState       Json?
  onboardingCompleted   Boolean   @default(false)
  onboardingSkipped     Boolean   @default(false)
  onboardingCompletedAt DateTime?
  helpToursCompleted    Json      @default("[]")
  customSettings        Json      @default("{}")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// Onboarding Analytics
model OnboardingAnalytics {
  id        String   @id @default(cuid())
  userId    String
  stepId    String
  action    String   // started, completed, skipped, back
  timeSpent Int?     // seconds
  metadata  Json?
  timestamp DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([stepId])
  @@index([timestamp])
}

// Progress Tracking
model ProgressEvent {
  id            String   @id @default(cuid())
  jobId         String
  stage         String
  status        String
  progress      Int
  details       String?
  error         String?
  estimatedTime Int?
  metadata      Json     @default("{}")
  timestamp     DateTime @default(now())
  
  @@index([jobId])
  @@index([jobId, timestamp])
}

// Background Jobs
model BackgroundJob {
  id          String    @id @default(cuid())
  userId      String
  type        String
  title       String
  status      String
  progress    Int       @default(0)
  result      Json?
  error       String?
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  metadata    Json      @default("{}")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([status])
  @@index([userId, status])
}

// Help System Analytics
model HelpAnalytics {
  id        String   @id @default(cuid())
  userId    String
  tourId    String?
  stepId    String?
  contentId String?
  action    String   // viewed, completed, searched, clicked
  query     String?  // for search actions
  metadata  Json?
  timestamp DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tourId])
  @@index([action])
  @@index([timestamp])
}

// Widget Usage Analytics
model WidgetAnalytics {
  id         String   @id @default(cuid())
  userId     String
  widgetType String
  action     String   // viewed, interacted, customized, removed
  duration   Int?     // seconds
  metadata   Json?
  timestamp  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([widgetType])
  @@index([timestamp])
}
```

## Error Handling

### Error Scenarios and Recovery

#### 1. Onboarding Errors

```typescript
// apps/web/lib/onboarding/error-handler.ts

export class OnboardingErrorHandler {
  async handleError(error: Error, context: OnboardingContext) {
    // Log error
    console.error('Onboarding error:', error, context)
    
    // Save current state
    await this.saveOnboardingState(context.userId, context.state)
    
    // Determine recovery action
    if (error.message.includes('network')) {
      return {
        type: 'retry',
        message: 'Network error. Please check your connection and try again.',
        action: () => this.retryStep(context)
      }
    }
    
    if (error.message.includes('validation')) {
      return {
        type: 'validation',
        message: 'Please check your input and try again.',
        action: () => this.showValidationErrors(context)
      }
    }
    
    // Default: allow skip
    return {
      type: 'skip',
      message: 'Something went wrong. You can skip this step and continue.',
      action: () => this.skipStep(context)
    }
  }
  
  private async saveOnboardingState(userId: string, state: OnboardingState) {
    await fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    })
  }
}
```

#### 2. Progress Tracking Errors

```typescript
// packages/data-orchestration/src/services/progress-error-handler.ts

export class ProgressErrorHandler {
  async handleJobFailure(jobId: string, error: Error, stage: string) {
    // Emit failure event
    await progressService.emitProgress({
      jobId,
      stage,
      status: 'failed',
      progress: 0,
      error: error.message,
      timestamp: new Date()
    })
    
    // Determine if retryable
    const isRetryable = this.isRetryableError(error)
    
    if (isRetryable) {
      // Schedule retry
      await this.scheduleRetry(jobId, stage)
      
      return {
        type: 'retry',
        message: 'Job failed but will be retried automatically.',
        retryIn: 60 // seconds
      }
    }
    
    // Not retryable - provide recovery options
    return {
      type: 'manual',
      message: 'Job failed. Please review the error and try again.',
      actions: [
        {
          label: 'Retry Now',
          action: () => this.retryJob(jobId)
        },
        {
          label: 'Contact Support',
          action: () => this.contactSupport(jobId, error)
        }
      ]
    }
  }
  
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /rate limit/i,
      /temporary/i
    ]
    
    return retryablePatterns.some(pattern => 
      pattern.test(error.message)
    )
  }
}
```

#### 3. Dashboard Customization Errors

```typescript
// apps/web/lib/dashboard/error-handler.ts

export class DashboardErrorHandler {
  async handleLayoutSaveError(error: Error, layout: DashboardLayout) {
    // Save to localStorage as backup
    localStorage.setItem('dashboard-layout-backup', JSON.stringify(layout))
    
    // Show user-friendly error
    return {
      type: 'warning',
      message: 'Could not save dashboard layout. Changes saved locally.',
      action: {
        label: 'Retry Save',
        handler: () => this.retrySave(layout)
      }
    }
  }
  
  async handleWidgetLoadError(widgetId: string, error: Error) {
    // Log error
    console.error(`Widget ${widgetId} failed to load:`, error)
    
    // Return fallback widget
    return {
      type: 'fallback',
      widget: {
        id: widgetId,
        type: 'error',
        title: 'Widget Unavailable',
        content: 'This widget could not be loaded. Please try refreshing.',
        actions: [
          {
            label: 'Refresh',
            handler: () => this.refreshWidget(widgetId)
          },
          {
            label: 'Remove',
            handler: () => this.removeWidget(widgetId)
          }
        ]
      }
    }
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// apps/web/__tests__/onboarding/onboarding-wizard.test.tsx

describe('OnboardingWizard', () => {
  it('should display welcome step on first render', () => {
    render(<OnboardingWizard onComplete={jest.fn()} onSkip={jest.fn()} />)
    expect(screen.getByText('Welcome to Chain IQ')).toBeInTheDocument()
  })
  
  it('should progress through steps', async () => {
    const onComplete = jest.fn()
    render(<OnboardingWizard onComplete={onComplete} onSkip={jest.fn()} />)
    
    // Click through steps
    await userEvent.click(screen.getByText('Get Started'))
    expect(screen.getByText("What's your role?")).toBeInTheDocument()
    
    await userEvent.click(screen.getByText('Procurement Manager'))
    await userEvent.click(screen.getByText('Continue'))
    
    // Should eventually complete
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
  })
  
  it('should save progress on each step', async () => {
    const mockFetch = jest.spyOn(global, 'fetch')
    render(<OnboardingWizard onComplete={jest.fn()} onSkip={jest.fn()} />)
    
    await userEvent.click(screen.getByText('Get Started'))
    await userEvent.click(screen.getByText('Procurement Manager'))
    await userEvent.click(screen.getByText('Continue'))
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/onboarding',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('procurement-manager')
      })
    )
  })
  
  it('should allow skipping', async () => {
    const onSkip = jest.fn()
    render(<OnboardingWizard onComplete={jest.fn()} onSkip={onSkip} />)
    
    await userEvent.click(screen.getByText('Skip for now'))
    expect(onSkip).toHaveBeenCalled()
  })
})
```

### Integration Tests

```typescript
// apps/web/__tests__/integration/dashboard-personalization.test.tsx

describe('Dashboard Personalization', () => {
  it('should load role-based default layout', async () => {
    // Mock user with analyst role
    mockSession({ role: 'analyst' })
    
    render(<PersonalizedDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Spend Analysis')).toBeInTheDocument()
      expect(screen.getByText('Rate Benchmarking')).toBeInTheDocument()
    })
  })
  
  it('should save custom layout', async () => {
    const mockFetch = jest.spyOn(global, 'fetch')
    render(<PersonalizedDashboard />)
    
    // Drag widget to new position
    const widget = screen.getByTestId('widget-savings-pipeline')
    await dragAndDrop(widget, { x: 100, y: 100 })
    
    // Should save layout
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/dashboard/layout',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })
  
  it('should show AI widget suggestions', async () => {
    // Mock user with frequent rate card activity
    mockUserActivity([
      { action: 'rate-card-view', count: 10 },
      { action: 'rate-card-upload', count: 5 }
    ])
    
    render(<PersonalizedDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Suggested for you')).toBeInTheDocument()
      expect(screen.getByText('Rate Benchmarking')).toBeInTheDocument()
      expect(screen.getByText('You frequently work with rate cards')).toBeInTheDocument()
    })
  })
})
```

### E2E Tests

```typescript
// apps/web/__tests__/e2e/onboarding-flow.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test('complete onboarding as procurement manager', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should show onboarding wizard
    await expect(page.locator('text=Welcome to Chain IQ')).toBeVisible()
    
    // Step 1: Welcome
    await page.click('text=Get Started')
    
    // Step 2: Role selection
    await expect(page.locator('text=What\'s your role?')).toBeVisible()
    await page.click('text=Procurement Manager')
    await page.click('text=Continue')
    
    // Step 3: Goals
    await expect(page.locator('text=What are your main goals?')).toBeVisible()
    await page.click('text=Save Money')
    await page.click('text=Ensure Compliance')
    await page.click('text=Continue')
    
    // Step 4: Completion
    await expect(page.locator('text=You\'re all set!')).toBeVisible()
    await page.click('text=Go to Dashboard')
    
    // Should see personalized dashboard
    await expect(page.locator('text=Upcoming Renewals')).toBeVisible()
    await expect(page.locator('text=Savings Pipeline')).toBeVisible()
  })
  
  test('resume onboarding after skip', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Skip onboarding
    await page.click('text=Skip for now')
    
    // Should see dashboard with resume option
    await expect(page.locator('text=Resume onboarding')).toBeVisible()
    
    // Click resume
    await page.click('text=Resume onboarding')
    
    // Should restart onboarding
    await expect(page.locator('text=Welcome to Chain IQ')).toBeVisible()
  })
})
```

### Performance Tests

```typescript
// apps/web/__tests__/performance/dashboard-load.test.ts

describe('Dashboard Performance', () => {
  it('should load dashboard in under 1 second', async () => {
    const startTime = performance.now()
    
    render(<PersonalizedDashboard />)
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-loaded')).toBeInTheDocument()
    })
    
    const loadTime = performance.now() - startTime
    expect(loadTime).toBeLessThan(1000)
  })
  
  it('should render 12 widgets without performance degradation', async () => {
    const widgets = Array.from({ length: 12 }, (_, i) => ({
      id: `widget-${i}`,
      type: 'metric',
      title: `Widget ${i}`,
      size: 'medium',
      position: { x: i % 4, y: Math.floor(i / 4), w: 3, h: 2 },
      visible: true
    }))
    
    const startTime = performance.now()
    
    render(<PersonalizedDashboard initialWidgets={widgets} />)
    
    await waitFor(() => {
      expect(screen.getAllByTestId(/^widget-/)).toHaveLength(12)
    })
    
    const renderTime = performance.now() - startTime
    expect(renderTime).toBeLessThan(2000)
  })
})
```

## Security Considerations

### 1. User Data Protection

- All user preferences stored encrypted at rest
- Dashboard layouts sanitized to prevent XSS
- Help content served from trusted sources only
- Tour definitions validated before execution

### 2. API Security

```typescript
// Middleware for preference endpoints
export async function validateUserOwnership(
  request: NextRequest,
  resourceUserId: string
) {
  const sessionUserId = await getUserIdFromSession(request)
  
  if (sessionUserId !== resourceUserId) {
    throw new Error('Unauthorized: Cannot access another user\'s data')
  }
}

// Rate limiting for progress updates
export const progressRateLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 updates per second per job
  keyGenerator: (req) => req.query.jobId
})
```

### 3. WebSocket Security

```typescript
// Socket.io authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  
  try {
    const user = await verifyToken(token)
    socket.data.userId = user.id
    next()
  } catch (error) {
    next(new Error('Authentication failed'))
  }
})

// Room access control
io.on('connection', (socket) => {
  socket.on('subscribe:job', async (jobId) => {
    // Verify user owns this job
    const job = await prisma.processingJob.findUnique({
      where: { id: jobId },
      include: { contract: true }
    })
    
    if (job?.contract.tenantId !== socket.data.tenantId) {
      socket.emit('error', 'Unauthorized')
      return
    }
    
    socket.join(`job:${jobId}`)
  })
})
```

## Performance Optimization

### 1. Dashboard Widget Lazy Loading

```typescript
// apps/web/components/dashboard/LazyWidget.tsx

const WidgetComponents = {
  'upcoming-renewals': lazy(() => import('./widgets/UpcomingRenewals')),
  'savings-pipeline': lazy(() => import('./widgets/SavingsPipeline')),
  'spend-analysis': lazy(() => import('./widgets/SpendAnalysis')),
  // ... other widgets
}

export function LazyWidget({ widget }: { widget: DashboardWidget }) {
  const Component = WidgetComponents[widget.type]
  
  return (
    <Suspense fallback={<WidgetSkeleton />}>
      <Component config={widget.config} />
    </Suspense>
  )
}
```

### 2. Progress Event Batching

```typescript
// Batch progress updates to reduce WebSocket traffic
export class ProgressBatcher {
  private batch: ProgressEvent[] = []
  private timer: NodeJS.Timeout | null = null
  
  add(event: ProgressEvent) {
    this.batch.push(event)
    
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 100) // 100ms batch window
    }
  }
  
  private flush() {
    if (this.batch.length > 0) {
      io.emit('job:progress:batch', this.batch)
      this.batch = []
    }
    this.timer = null
  }
}
```

### 3. Help Content Caching

```typescript
// Cache help content in memory and CDN
export class CachedHelpContentManager extends HelpContentManager {
  private cache: Map<string, { content: HelpContent; expires: number }> = new Map()
  private readonly TTL = 3600000 // 1 hour
  
  getContentForElement(elementId: string): HelpContent | null {
    const cached = this.cache.get(elementId)
    
    if (cached && cached.expires > Date.now()) {
      return cached.content
    }
    
    const content = super.getContentForElement(elementId)
    
    if (content) {
      this.cache.set(elementId, {
        content,
        expires: Date.now() + this.TTL
      })
    }
    
    return content
  }
}
```

## Deployment Considerations

### 1. Database Migrations

```bash
# Run migrations for new tables
npx prisma migrate dev --name add_ux_quick_wins_tables

# Seed default help content
npm run seed:help-content
```

### 2. WebSocket Server Setup

```typescript
// server.ts - Add WebSocket support to Next.js

import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })
  
  const io = new SocketIOServer(server, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true
    }
  })
  
  // Initialize progress tracking service
  const progressService = new ProgressTrackingService(io)
  global.progressService = progressService
  
  server.listen(3000, () => {
    console.log('> Ready on http://localhost:3000')
  })
})
```

### 3. Environment Variables

```env
# .env.local

# WebSocket URL
NEXT_PUBLIC_WS_URL=http://localhost:3000

# Help content source
HELP_CONTENT_SOURCE=filesystem # or 'cms'
HELP_CMS_API_KEY=your-cms-api-key

# Feature flags
FEATURE_ONBOARDING_ENABLED=true
FEATURE_DASHBOARD_PERSONALIZATION_ENABLED=true
FEATURE_PROGRESS_TRACKING_ENABLED=true
FEATURE_CONTEXTUAL_HELP_ENABLED=true
```

### 4. Monitoring and Analytics

```typescript
// Track UX metrics
export class UXMetricsCollector {
  async trackOnboardingCompletion(userId: string, timeSpent: number) {
    await analytics.track({
      event: 'onboarding_completed',
      userId,
      properties: {
        timeSpent,
        timestamp: new Date()
      }
    })
  }
  
  async trackDashboardCustomization(userId: string, widgetCount: number) {
    await analytics.track({
      event: 'dashboard_customized',
      userId,
      properties: {
        widgetCount,
        timestamp: new Date()
      }
    })
  }
  
  async trackHelpUsage(userId: string, contentId: string, type: string) {
    await analytics.track({
      event: 'help_accessed',
      userId,
      properties: {
        contentId,
        type,
        timestamp: new Date()
      }
    })
  }
}
```

## Success Metrics and Monitoring

### Key Performance Indicators

1. **Onboarding Completion Rate**: Target 85%+
2. **Time to First Value**: Target < 5 minutes
3. **Dashboard Customization Rate**: Target 60%+
4. **Help Content Usage**: Target 70% of users access help
5. **Feature Discovery**: Target 80% of users try 3+ use cases

### Monitoring Dashboard

```typescript
// Real-time UX metrics dashboard
export async function getUXMetrics(tenantId: string) {
  const [
    onboardingStats,
    dashboardStats,
    helpStats,
    progressStats
  ] = await Promise.all([
    getOnboardingStats(tenantId),
    getDashboardStats(tenantId),
    getHelpStats(tenantId),
    getProgressStats(tenantId)
  ])
  
  return {
    onboarding: {
      completionRate: onboardingStats.completed / onboardingStats.total,
      avgTimeToComplete: onboardingStats.avgTime,
      skipRate: onboardingStats.skipped / onboardingStats.total
    },
    dashboard: {
      customizationRate: dashboardStats.customized / dashboardStats.total,
      avgWidgetsPerUser: dashboardStats.avgWidgets,
      mostUsedWidgets: dashboardStats.topWidgets
    },
    help: {
      usageRate: helpStats.usersWithHelp / helpStats.totalUsers,
      mostViewedContent: helpStats.topContent,
      tourCompletionRate: helpStats.toursCompleted / helpStats.toursStarted
    },
    progress: {
      avgJobDuration: progressStats.avgDuration,
      backgroundJobRate: progressStats.backgroundJobs / progressStats.totalJobs,
      errorRate: progressStats.failed / progressStats.total
    }
  }
}
```

---

**Design Status**: ✅ Complete and Ready for Implementation
**Next Step**: Create implementation tasks based on this design
