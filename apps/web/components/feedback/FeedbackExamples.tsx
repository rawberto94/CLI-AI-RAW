/**
 * Feedback System Examples
 * Demonstrates usage of the feedback system
 */

'use client';

import React, { useState } from 'react';
import { 
  useFeedback, 
  InlineError, 
  InlineSuccess,
  FieldError 
} from './FeedbackSystem';

export function FeedbackExamples() {
  const feedback = useFeedback();
  const [formError, setFormError] = useState('');
  const [showInlineError, setShowInlineError] = useState(false);
  const [showInlineSuccess, setShowInlineSuccess] = useState(false);

  // Success Toast Example
  const handleSuccess = () => {
    feedback.showSuccess(
      'Contract Uploaded',
      'Your contract has been successfully uploaded and is being processed.',
      {
        action: {
          label: 'View Contract',
          onClick: () => console.log('Navigate to contract'),
        },
      }
    );
  };

  // Error Toast Example
  const handleError = () => {
    feedback.showError(
      'Upload Failed',
      'There was an error uploading your contract. Please try again.',
      {
        action: {
          label: 'Retry',
          onClick: () => console.log('Retry upload'),
        },
      }
    );
  };

  // Warning Toast Example
  const handleWarning = () => {
    feedback.showWarning(
      'Large File Detected',
      'This file is larger than recommended. Processing may take longer.',
    );
  };

  // Info Toast Example
  const handleInfo = () => {
    feedback.showInfo(
      'New Feature Available',
      'Check out our new rate card benchmarking feature!',
      {
        action: {
          label: 'Learn More',
          onClick: () => console.log('Navigate to feature'),
        },
      }
    );
  };

  // Progress Notification Example
  const handleProgress = async () => {
    const id = feedback.showProgress(
      'Processing Contract',
      0,
      'Uploading file...'
    );

    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const messages = [
        'Uploading file...',
        'Extracting text...',
        'Analyzing content...',
        'Generating artifacts...',
        'Finalizing...',
      ];
      const messageIndex = Math.floor((i / 100) * messages.length);
      feedback.updateProgress(id, i, messages[messageIndex]);
    }

    // Show success after completion
    setTimeout(() => {
      feedback.showSuccess('Processing Complete', 'Your contract is ready to view.');
    }, 1500);
  };

  // Multiple Notifications Example
  const handleMultiple = () => {
    feedback.showInfo('Starting batch operation...');
    
    setTimeout(() => {
      feedback.showSuccess('Contract 1 processed');
    }, 1000);
    
    setTimeout(() => {
      feedback.showSuccess('Contract 2 processed');
    }, 2000);
    
    setTimeout(() => {
      feedback.showWarning('Contract 3 has warnings');
    }, 3000);
    
    setTimeout(() => {
      feedback.showSuccess('Batch operation complete', 'All contracts have been processed.');
    }, 4000);
  };

  // Form Validation Example
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('This field is required');
    
    setTimeout(() => {
      setFormError('');
      feedback.showSuccess('Form Submitted', 'Your changes have been saved.');
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Feedback System Examples</h2>
        <p className="text-gray-600">
          Demonstrates various feedback mechanisms for user actions
        </p>
      </div>

      {/* Toast Notifications */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Toast Notifications</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSuccess}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Show Success
          </button>
          <button
            onClick={handleError}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Show Error
          </button>
          <button
            onClick={handleWarning}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Show Warning
          </button>
          <button
            onClick={handleInfo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Show Info
          </button>
        </div>
      </section>

      {/* Progress Notifications */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Progress Notifications</h3>
        <button
          onClick={handleProgress}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Show Progress
        </button>
      </section>

      {/* Multiple Notifications */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Multiple Notifications</h3>
        <button
          onClick={handleMultiple}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Trigger Multiple
        </button>
      </section>

      {/* Inline Messages */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Inline Messages</h3>
        <div className="space-y-3">
          <button
            onClick={() => setShowInlineError(!showInlineError)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Toggle Inline Error
          </button>
          {showInlineError && (
            <InlineError
              message="Unable to connect to the server. Please check your internet connection."
              onRetry={() => console.log('Retry')}
              onDismiss={() => setShowInlineError(false)}
            />
          )}

          <button
            onClick={() => setShowInlineSuccess(!showInlineSuccess)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Toggle Inline Success
          </button>
          {showInlineSuccess && (
            <InlineSuccess
              message="Your settings have been saved successfully."
              onDismiss={() => setShowInlineSuccess(false)}
            />
          )}
        </div>
      </section>

      {/* Form Field Errors */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Form Field Errors</h3>
        <form onSubmit={handleFormSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="contractName" className="block text-sm font-medium text-gray-700 mb-1">
              Contract Name
            </label>
            <input
              id="contractName"
              type="text"
              className={`
                w-full px-3 py-2 border rounded-lg
                ${formError ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="Enter contract name"
            />
            <FieldError error={formError} />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Submit
          </button>
        </form>
      </section>

      {/* Dismiss All */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Actions</h3>
        <button
          onClick={() => feedback.dismissAll()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Dismiss All Notifications
        </button>
      </section>
    </div>
  );
}
