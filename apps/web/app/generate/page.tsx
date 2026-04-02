import { redirect } from 'next/navigation';
import { BLANK_DRAFTING_PATH, buildTemplateLibraryPath } from '@/lib/drafting/template-routing';

type GenerateSearchParams = Promise<Record<string, string | string[] | undefined>>;

function getFirstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toQueryString(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    }
  }

  return params.toString();
}

/**
 * /generate → redirects legacy creation links to the current drafting flows.
 *
 * Preserves query parameters (e.g. ?create=renewal&from=xxx) so that
 * deep-links from other features continue to work.
 */
export default async function GenerateRedirect({
  searchParams,
}: {
  searchParams: GenerateSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const create = getFirstValue(resolvedSearchParams.create);
  const from = getFirstValue(resolvedSearchParams.from);
  const type = getFirstValue(resolvedSearchParams.type);
  const playbook = getFirstValue(resolvedSearchParams.playbook) || getFirstValue(resolvedSearchParams.playbookId);

  if (create === 'new' || create === 'blank') {
    redirect(BLANK_DRAFTING_PATH);
  }

  if (create === 'template') {
    redirect(buildTemplateLibraryPath(type));
  }

  if (create === 'renewal') {
    if (from) {
      const renewalParams = new URLSearchParams();
      if (playbook) {
        renewalParams.set('playbook', playbook);
      }

      const renewalQuery = renewalParams.toString();
      redirect(renewalQuery ? `/contracts/${from}/renew?${renewalQuery}` : `/contracts/${from}/renew`);
    }

    redirect('/renewals');
  }

  if (create === 'amendment') {
    if (from) {
      const amendmentParams = new URLSearchParams({
        mode: 'amendment',
        from,
      });

      if (playbook) {
        amendmentParams.set('playbook', playbook);
      }

      redirect(`/drafting/copilot?${amendmentParams.toString()}`);
    }

    redirect('/drafting/copilot?mode=amendment');
  }

  const params = toQueryString(resolvedSearchParams);
  redirect(params ? `/drafting?${params}` : '/drafting');
}
