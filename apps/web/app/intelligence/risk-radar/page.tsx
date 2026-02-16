/**
 * Intelligence Risk Radar Page
 * Mounts the RiskRadarDashboard component for visual risk assessment
 */

import RiskRadarDashboard from "@/components/intelligence/RiskRadarDashboard";

export const metadata = {
  title: "Risk Radar | Intelligence",
  description: "Visual risk assessment dashboard with severity analysis",
};

export default function RiskRadarPage() {
  return <RiskRadarDashboard />;
}
