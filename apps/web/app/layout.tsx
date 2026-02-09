import "./globals.css";
import "../styles/orchestrator.css";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { HealthBanner } from "./health-banner";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { DataModeProvider } from "@/contexts/DataModeContext";
import { ToastProvider } from "@/components/ui/toast-provider";
import { Toaster } from "sonner";
import { GlobalErrorBoundary } from "@/components/errors/GlobalErrorBoundary";
import { RealTimeProvider } from "@/contexts/RealTimeContext";
import { ModuleProvider } from "@/contexts/ModuleContext";
import { GlobalKeyboardShortcuts } from "@/components/keyboard/GlobalKeyboardShortcuts";
import { GlobalKeyboardShortcutsProvider } from "@/providers/GlobalKeyboardShortcutsProvider";
import { FeedbackProvider } from "@/components/feedback/FeedbackSystem";
import { QueryProvider } from "@/lib/query-client";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { RealTimeSyncProvider } from "@/components/providers/RealTimeSyncProvider";
import { TenantContextBanner } from "@/components/platform/TenantContextBanner";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { UndoToastProvider } from "@/components/ui/undo-toast";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { CommandPaletteProvider } from "@/components/command/CommandPalette";
import { ConfirmProvider } from "@/components/dialogs/ConfirmDialog";
import { AnnouncerProvider } from "@/components/accessibility";
import { WelcomeTourProvider, WelcomeModal, WelcomeTourOverlay } from "@/components/welcome";
import { CSRFProvider } from "@/components/providers/csrf-provider";

// Load Inter font with optimal settings
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "ConTigo - AI Contract Management",
  description: "AI-powered contract management and analysis platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ConTigo",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7C3AED",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans antialiased">
        {/* Skip to main content link for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <GlobalErrorBoundary>
          <Toaster position="top-right" richColors closeButton />
          <ThemeProvider defaultTheme="system" storageKey="contigo-theme">
            <AuthProvider>
              <CSRFProvider>
              <QueryProvider>
                <WebSocketProvider>
                  <RealTimeSyncProvider>
                    <DataModeProvider>
                      <ToastProvider>
                        <UndoToastProvider>
                          <RealTimeProvider showConnectionToasts={false}>
                            <ModuleProvider>
                              <FeedbackProvider>
                                <CommandPaletteProvider>
                                  <ConfirmProvider>
                                    <AnnouncerProvider>
                                    <WelcomeTourProvider autoShowForNewUsers={true}>
                                    <GlobalKeyboardShortcuts>
                                    <GlobalKeyboardShortcutsProvider>
                                    <Suspense fallback={null}>
                                      <TenantContextBanner />
                                    </Suspense>
                                    <HealthBanner />
                                    <ConditionalLayout>
                                      {children}
                                    </ConditionalLayout>
                                    <WelcomeModal />
                                    <WelcomeTourOverlay />
                                    </GlobalKeyboardShortcutsProvider>
                                    </GlobalKeyboardShortcuts>
                                    </WelcomeTourProvider>
                                    </AnnouncerProvider>
                                  </ConfirmProvider>
                                </CommandPaletteProvider>
                              </FeedbackProvider>
                            </ModuleProvider>
                          </RealTimeProvider>
                        </UndoToastProvider>
                      </ToastProvider>
                    </DataModeProvider>
                  </RealTimeSyncProvider>
                </WebSocketProvider>
              </QueryProvider>
              </CSRFProvider>
            </AuthProvider>
          </ThemeProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
