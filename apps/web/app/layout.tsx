import "./globals.css";

import { HealthBanner } from "./health-banner";
import MainNavigation from "@/components/layout/MainNavigation";

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
      </body>
    </html>
  );
}
