import { getRequestConfig } from 'next-intl/server';

import deMessages from './messages/de.json';
import enMessages from './messages/en.json';
import esMessages from './messages/es.json';
import frMessages from './messages/fr.json';
import itMessages from './messages/it.json';

export const locales = ['en', 'es', 'de', 'fr', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const messagesByLocale: Record<Locale, typeof enMessages> = {
  de: deMessages,
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  it: itMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  const resolvedLocale = locales.includes(locale as Locale) ? locale : defaultLocale;

  return {
    locale: resolvedLocale,
    messages: messagesByLocale[resolvedLocale as Locale],
  };
});
