import { redirect } from 'next/navigation';

type LoginSearchParams = Promise<Record<string, string | string[] | undefined>>;

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

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const query = toQueryString(resolvedSearchParams);

  redirect(query ? `/auth/signin?${query}` : '/auth/signin');
}