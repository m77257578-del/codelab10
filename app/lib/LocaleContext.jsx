'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, createTranslator } from './i18n';

const LocaleContext = createContext(createTranslator(DEFAULT_LOCALE));

export function I18nProvider({ locale = DEFAULT_LOCALE, children }) {
  const value = useMemo(() => createTranslator(locale), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}
