import RiskDashboardClient from './RiskDashboardClient';

export const metadata = {
  title: 'Risk Management | ConTigo',
  description: 'Monitor, assess, and mitigate contract portfolio risks',
};

export default function RiskPage() {
  return <RiskDashboardClient />;
}
