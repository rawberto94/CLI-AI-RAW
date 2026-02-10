import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es', 'de', 'fr', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  const resolvedLocale = locales.includes(locale as Locale) ? locale : defaultLocale;

  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}.json`)).default,
  };
});
