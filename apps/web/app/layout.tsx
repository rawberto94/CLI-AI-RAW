import "./globals.css";
import "../styles/rate-benchmarking-animations.css";

import { HealthBanner } from "./health-banner";

import { FloatingDemoButton } from "@/components/FloatingDemoButton";
import MainNavigation from "@/components/layout/MainNavigation";
import { GlobalCommandPalette } from "@/components/command/GlobalCommandPalette";
import { OnboardingWrapper } from "@/components/OnboardingWrapper";
import { GlobalKeyboardShortcuts } from "@/components/keyboard/GlobalKeyboardShortcuts";

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
        <HealthBanner />
        <MainNavigation />
        <div className="lg:pl-64 pt-16 lg:pt-0">{children}</div>
        <FloatingDemoButton />
        <GlobalCommandPalette />
        <GlobalKeyboardShortcuts />
        <OnboardingWrapper />
      </body>
    </html>
  );
}
