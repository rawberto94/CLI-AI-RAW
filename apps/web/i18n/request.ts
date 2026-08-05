import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import deMessages from '../messages/de.json';
import enMessages from '../messages/en.json';
import esMessages from '../messages/es.json';
import frMessages from '../messages/fr.json';
import itMessages from '../messages/it.json';

export const locales = ['en', 'es', 'de', 'fr', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// Client-writable cookie the Settings language toggle uses to switch locale
// without a full sign-in/route redirect (this app has no [locale] route segment).
export const LOCALE_COOKIE = 'NEXT_LOCALE';

const messagesByLocale: Record<Locale, typeof enMessages> = {
  de: deMessages,
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  it: itMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const requested = cookieLocale ?? (await requestLocale);
  const resolvedLocale = locales.includes(requested as Locale) ? (requested as Locale) : defaultLocale;

  return {
    locale: resolvedLocale,
    messages: messagesByLocale[resolvedLocale as Locale],
  };
});
