import EscalationConfigClient from './EscalationConfigClient';

export const metadata = {
  title: 'Escalation Configuration | ConTigo',
  description: 'Configure automatic escalation rules and notifications',
};

export default function EscalationConfigPage() {
  return <EscalationConfigClient />;
}
