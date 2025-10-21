import "./globals.css";

import { HealthBanner } from "./health-banner";
import MainNavigation from "@/components/layout/MainNavigation";
import { DataModeProvider } from "@/contexts/DataModeContext";
import { EnhancedDataModeToggle } from "@/components/ui/enhanced-data-mode-toggle";

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
      <body className="min-h-screen bg-background font-sans antialiased">
        <DataModeProvider>
          <HealthBanner />
          <MainNavigation />
          <div className="lg:pl-64 pt-16 lg:pt-0">
            {/* Data Mode Toggle - Fixed Position */}
            <div className="fixed top-4 right-4 z-50">
              <EnhancedDataModeToggle />
            </div>
            {children}
          </div>
        </DataModeProvider>
      </body>
    </html>
  );
}
