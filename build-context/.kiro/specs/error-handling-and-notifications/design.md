# Error Handling & Notification Center - Design

## Overview

This design document outlines the implementation of enhanced error handling and a complete notification center UI for the Contract Intelligence Platform.

## Architecture

### Component Structure

```
apps/web/
├── components/
│   ├── notifications/
│   │   ├── NotificationBell.tsx          # Bell icon with badge
│   │   ├── NotificationDropdown.tsx      # Dropdown with recent notifications
│   │   ├── NotificationItem.tsx          # Individual notification
│   │   ├── NotificationList.tsx          # Full list page
│   │   └── NotificationPreferences.tsx   # Settings
│   ├── errors/
│   │   ├── ErrorBoundary.tsx             # Global error boundary
│   │   ├── ErrorFallback.tsx             # Error UI
│   │   └── RetryButton.tsx               # Retry action
│   └── feedback/
│       ├── Toast.tsx                     # Toast notification
│       ├── LoadingButton.tsx             # Button with loading state
│       └── ProgressBar.tsx               # Upload progress
├── hooks/
│   ├── useToast.ts                       # Toast hook
│   ├── useNotifications.ts               # Notifications hook
│   └── useErrorHandler.ts                # Error handling hook
├── lib/
│   ├── error-handler.ts                  # Error handling utilities
│   ├── notification-service.ts           # Notification service
│   └── sentry.ts                         # Sentry configuration
└── app/
    ├── notifications/
    │   └── page.tsx                      # Full notifications page
    └── api/
        └── notifications/
            ├── route.ts                  # List notifications
            ├── [id]/
            │   ├── route.ts              # Get/update notification
            │   └── read/route.ts         # Mark as read
            └── preferences/route.ts      # User preferences
```

## Components

### 1. Toast Notification System

**Library:** `react-hot-toast` (already installed)

**Features:**
- Success, error, warning, info types
- Auto-dismiss with configurable duration
- Action buttons (retry, undo, etc.)
- Stacking and positioning
- Custom styling

**Implementation:**
```typescript
// hooks/useToast.ts
import { toast } from 'react-hot-toast';

export const useToast = () => {
  const success = (message: string, options?) => {
    toast.success(message, {
      duration: 4000,
      position: 'top-right',
      ...options,
    });
  };

  const error = (message: string, options?) => {
    toast.error(message, {
      duration: 6000,
      position: 'top-right',
      ...options,
    });
  };

  const loading = (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    });
  };

  const promise = <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages, {
      position: 'top-right',
    });
  };

  return { success, error, loading, promise, dismiss: toast.dismiss };
};
```

### 2. Error Boundary

**Purpose:** Catch React errors and display fallback UI

**Implementation:**
```typescript
// components/errors/ErrorBoundary.tsx
'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}
```

### 3. Notification Bell Component

**Features:**
- Badge with unread count
- Dropdown with recent notifications
- Real-time updates via polling or WebSocket
- Mark as read functionality

**Implementation:**
```typescript
// components/notifications/NotificationBell.tsx
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { NotificationDropdown } from './NotificationDropdown';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, refetch } = useNotifications();

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <NotificationDropdown
          notifications={notifications}
          onMarkAsRead={markAsRead}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 4. Error Handler Hook

**Purpose:** Centralized error handling logic

**Implementation:**
```typescript
// hooks/useErrorHandler.ts
import { useCallback } from 'react';
import { useToast } from './useToast';
import * as Sentry from '@sentry/nextjs';

export const useErrorHandler = () => {
  const { error: showError } = useToast();

  const handleError = useCallback((error: unknown, context?: Record<string, any>) => {
    // Log to Sentry
    Sentry.captureException(error, {
      extra: context,
    });

    // Determine user-friendly message
    let message = 'An unexpected error occurred. Please try again.';

    if (error instanceof Error) {
      // Map common errors to user-friendly messages
      if (error.message.includes('Network')) {
        message = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('timeout')) {
        message = 'Request timed out. Please try again.';
      } else if (error.message.includes('401')) {
        message = 'Your session has expired. Please log in again.';
      } else if (error.message.includes('403')) {
        message = 'You don\'t have permission to perform this action.';
      } else if (error.message.includes('404')) {
        message = 'The requested resource was not found.';
      } else if (error.message.includes('500')) {
        message = 'Server error. Our team has been notified.';
      }
    }

    // Show error toast
    showError(message);

    return message;
  }, [showError]);

  return { handleError };
};
```

## Data Models

### Notification Schema (Already exists in your DB)

```prisma
// Assuming you have a Notification model
model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        NotificationType
  title       String
  message     String
  link        String?
  read        Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())
  metadata    Json?
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, read])
  @@index([createdAt])
}

enum NotificationType {
  SUCCESS
  ERROR
  WARNING
  INFO
  CRITICAL
}
```

## API Endpoints

### GET /api/notifications
**Purpose:** List user notifications

**Query Parameters:**
- `limit` (default: 20)
- `offset` (default: 0)
- `unreadOnly` (boolean)

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "type": "SUCCESS",
      "title": "Contract Processed",
      "message": "Your contract has been successfully processed",
      "link": "/contracts/contract_123",
      "read": false,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "unreadCount": 5,
  "total": 42
}
```

### POST /api/notifications/[id]/read
**Purpose:** Mark notification as read

**Response:**
```json
{
  "success": true
}
```

### POST /api/notifications/mark-all-read
**Purpose:** Mark all notifications as read

**Response:**
```json
{
  "success": true,
  "count": 5
}
```

### GET /api/notifications/preferences
**Purpose:** Get user notification preferences

**Response:**
```json
{
  "emailNotifications": true,
  "types": {
    "CONTRACT_PROCESSED": true,
    "RATE_CARD_UPDATED": true,
    "SAVINGS_OPPORTUNITY": false
  }
}
```

## Error Handling Strategy

### 1. API Error Handling

```typescript
// lib/api-client.ts
export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Re-throw with context
    throw error;
  }
}
```

### 2. Form Error Handling

```typescript
// Use react-hook-form for form validation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {},
});

// Errors are automatically displayed inline
```

### 3. Upload Error Handling

```typescript
// components/contracts/EnhancedUploadZone.tsx
const handleUpload = async (file: File) => {
  const toastId = toast.loading('Uploading contract...');
  
  try {
    await uploadFile(file);
    toast.success('Contract uploaded successfully', { id: toastId });
  } catch (error) {
    const message = handleError(error);
    toast.error(message, {
      id: toastId,
      action: {
        label: 'Retry',
        onClick: () => handleUpload(file),
      },
    });
  }
};
```

## Testing Strategy

### Unit Tests
- Test error handler utility functions
- Test notification service methods
- Test toast hook

### Integration Tests
- Test error boundary catches errors
- Test notification bell displays count
- Test mark as read functionality

### E2E Tests
- Test user sees error toast on API failure
- Test user can retry failed operation
- Test user receives notification on contract completion

