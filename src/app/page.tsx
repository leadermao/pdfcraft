'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { locales, defaultLocale } from '@/lib/i18n/config';
import { getLanguagePreference } from '@/components/layout/LanguageSelector';

// Root page handles client-side redirection based on saved preference or browser language
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      // Saved preference takes priority over browser language
      const preferred = getLanguagePreference();
      if (preferred) {
        router.replace(`/${preferred}`);
        return;
      }

      // Get browser language
      const browserLang = navigator.language;
      const primaryLang = browserLang.split('-')[0];

      // Check if the language is supported
      if ((locales as readonly string[]).includes(primaryLang)) {
        router.replace(`/${primaryLang}`);
      } else {
        router.replace(`/${defaultLocale}`);
      }
    } catch (error) {
      // Fallback to default locale if anything goes wrong
      router.replace(`/${defaultLocale}`);
    }
  }, [router]);

  // Render nothing while redirecting
  return null;
}
