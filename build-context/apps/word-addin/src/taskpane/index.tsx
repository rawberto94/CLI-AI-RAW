/**
 * ConTigo Word Add-in - Main Taskpane
 * Contract Generation with Templates, Clauses, and AI Assistance
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

/* global Office */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    const root = createRoot(document.getElementById('root')!);
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    root.render(
      <React.StrictMode>
        <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </FluentProvider>
      </React.StrictMode>
    );
  }
});
