import "./globals.css";
import { Inter } from "next/font/google";

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

// Load Inter font with optimal settings
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "PactumAI - AI Contract Management",
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
        <GlobalErrorBoundary>
          <QueryProvider>
            <WebSocketProvider>
              <DataModeProvider>
                <ToastProvider>
                  <RealTimeProvider tenantId="demo" showConnectionToasts={false}>
                    <ModuleProvider>
                      <FeedbackProvider>
                        <GlobalKeyboardShortcuts>
                          <HealthBanner />
                          <EnhancedNavigation />
                          <main className="min-h-screen lg:pl-72 pt-16 lg:pt-0 bg-slate-50 overflow-x-hidden">
                            <div className="h-full w-full max-w-full">
                              {children}
                            </div>
                          </main>
                          <FloatingDataModeToggle />
                        </GlobalKeyboardShortcuts>
                      </FeedbackProvider>
                    </ModuleProvider>
                  </RealTimeProvider>
                </ToastProvider>
              </DataModeProvider>
            </WebSocketProvider>
          </QueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
