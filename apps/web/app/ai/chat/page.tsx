import { redirect } from 'next/navigation';

export default function AIChatRedirect() {
  redirect('/contigo-labs?tab=chat');
}
