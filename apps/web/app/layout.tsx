import "./globals.css";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { HealthBanner } from "./health-banner";
import EnhancedNavigation from "@/components/layout/EnhancedNavigation";
import { DataModeProvider } from "@/contexts/DataModeContext";
import { ToastProvider } from "@/components/ui/toast-provider";
import { GlobalErrorBoundary } from "@/components/errors/GlobalErrorBoundary";
import { RealTimeProvider } from "@/contexts/RealTimeContext";
import { ModuleProvider } from "@/contexts/ModuleContext";
import { GlobalKeyboardShortcuts } from "@/components/keyboard/GlobalKeyboardShortcuts";
import { FloatingDataModeToggle } from "@/components/ui/DataModeToggle";
import { FeedbackProvider } from "@/components/feedback/FeedbackSystem";
import { QueryProvider } from "@/lib/query-client";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { FloatingAIBubble } from "@/components/ai/FloatingAIBubble";
import { RealTimeSyncProvider } from "@/components/providers/RealTimeSyncProvider";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { TenantContextBanner } from "@/components/platform/TenantContextBanner";
import { AuthProvider } from "@/components/providers/AuthProvider";

// Load Inter font with optimal settings
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "ConTigo - AI Contract Management",
  description: "AI-powered contract management and analysis platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        {/* Skip to main content link for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <GlobalErrorBoundary>
          <AuthProvider>
            <QueryProvider>
              <WebSocketProvider>
                <RealTimeSyncProvider>
                  <DataModeProvider>
                    <ToastProvider>
                      <RealTimeProvider tenantId="demo" showConnectionToasts={false}>
                        <ModuleProvider>
                          <FeedbackProvider>
                            <GlobalKeyboardShortcuts>
                            <Suspense fallback={null}>
                              <TenantContextBanner />
                            </Suspense>
                            <HealthBanner />
                            <EnhancedNavigation />
                            <main 
                              id="main-content"
                              className="min-h-screen lg:pl-64 pt-16 lg:pt-0 bg-slate-50 overflow-x-hidden"
                              tabIndex={-1}
                            >
                              <div className="h-full w-full max-w-full">
                                {children}
                              </div>
                            </main>
                            <FloatingDataModeToggle />
                            <Suspense fallback={null}>
                              <FloatingAIBubble />
                            </Suspense>
                            <Suspense fallback={null}>
                              <WelcomeTutorial />
                            </Suspense>
                            </GlobalKeyboardShortcuts>
                          </FeedbackProvider>
                        </ModuleProvider>
                      </RealTimeProvider>
                    </ToastProvider>
                  </DataModeProvider>
                </RealTimeSyncProvider>
              </WebSocketProvider>
            </QueryProvider>
          </AuthProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
