/**
 * RetryButton Component
 * Button with retry logic and exponential backoff
 */

'use client';

import { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

interface RetryButtonProps extends Omit<ButtonProps, 'onClick'> {
  onRetry: () => Promise<void> | void;
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onMaxRetriesReached?: () => void;
  children?: React.ReactNode;
}

export function RetryButton({
  onRetry,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000,
  onMaxRetriesReached,
  children = 'Retry',
  ...buttonProps
}: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { error: showError, success: showSuccess } = useToast();

  const calculateDelay = useCallback((attempt: number): number => {
    // Exponential backoff: delay = initialDelay * 2^attempt
    const delay = initialDelay * Math.pow(2, attempt);
    return Math.min(delay, maxDelay);
  }, [initialDelay, maxDelay]);

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      showError('Maximum retry attempts reached. Please contact support if the issue persists.');
      if (onMaxRetriesReached) {
        onMaxRetriesReached();
      }
      return;
    }

    setIsRetrying(true);

    try {
      // Add delay for exponential backoff (except for first retry)
      if (retryCount > 0) {
        const delay = calculateDelay(retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      await onRetry();
      
      // Reset retry count on success
      setRetryCount(0);
      showSuccess('Operation completed successfully');
    } catch (error) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);

      if (newRetryCount >= maxRetries) {
        showError('Maximum retry attempts reached. Please contact support if the issue persists.');
        if (onMaxRetriesReached) {
          onMaxRetriesReached();
        }
      } else {
        const nextDelay = calculateDelay(newRetryCount);
        showError(
          `Retry failed. Attempt ${newRetryCount} of ${maxRetries}. ` +
          `Next retry in ${Math.round(nextDelay / 1000)}s...`
        );
      }
    } finally {
      setIsRetrying(false);
    }
  }, [
    retryCount,
    maxRetries,
    onRetry,
    calculateDelay,
    showError,
    showSuccess,
    onMaxRetriesReached,
  ]);

  return (
    <Button
      onClick={handleRetry}
      disabled={isRetrying || retryCount >= maxRetries}
      {...buttonProps}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying...' : children}
      {retryCount > 0 && retryCount < maxRetries && ` (${retryCount}/${maxRetries})`}
    </Button>
  );
}
