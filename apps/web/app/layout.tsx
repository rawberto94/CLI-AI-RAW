import "./globals.css";

import { HealthBanner } from "./health-banner";
import MainNavigation from "@/components/layout/MainNavigation";
import { DataModeProvider } from "@/contexts/DataModeContext";
import { EnhancedDataModeToggle } from "@/components/ui/enhanced-data-mode-toggle";
import { ChatAssistant } from "@/components/ai/ChatAssistant";
import { AIChatbot } from "@/components/AIChatbot";
import { DataModeBanner } from "@/components/ui/data-mode-banner";
import { ToastProvider } from "@/components/ui/toast-provider";
import { GlobalErrorBoundary } from "@/components/errors/GlobalErrorBoundary";
import { RealTimeProvider } from "@/contexts/RealTimeContext";

export const metadata = {
  title: "Contract Intelligence Platform",
  description: "AI-powered contract management and analysis platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white font-sans antialiased">
        <GlobalErrorBoundary>
          <DataModeProvider>
            <ToastProvider>
              <RealTimeProvider tenantId="demo" showConnectionToasts={false}>
                {/* Data Mode Banner - Disabled */}
                {/* <DataModeBanner /> */}
                <HealthBanner />
                <MainNavigation />
                <div className="min-h-screen lg:pl-64 pt-16 lg:pt-0 bg-white">
                  {/* Data Mode Toggle - Disabled to prevent overlay */}
                  {/* <div className="fixed top-4 right-4 z-50">
                    <EnhancedDataModeToggle />
                  </div> */}
                  {children}
                </div>
                {/* AI Chat Assistant - Available everywhere */}
                {/* <ChatAssistant /> */}
                {/* Enhanced AI Chatbot - Context-aware assistance */}
                {/* <AIChatbot context="global" /> */}
              </RealTimeProvider>
            </ToastProvider>
          </DataModeProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
