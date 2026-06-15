import React, { createContext, useContext, useState, useEffect } from 'react';

/* ── Supported Languages ── */
export const LANGUAGES = [
  { code: 'English',   label: 'English',   flag: '🇬🇧', native: 'English'   },
  { code: 'Hindi',     label: 'Hindi',     flag: '🇮🇳', native: 'हिन्दी'    },
  { code: 'Kannada',   label: 'Kannada',   flag: '🇮🇳', native: 'ಕನ್ನಡ'     },
  { code: 'Tamil',     label: 'Tamil',     flag: '🇮🇳', native: 'தமிழ்'     },
  { code: 'Telugu',    label: 'Telugu',    flag: '🇮🇳', native: 'తెలుగు'    },
  { code: 'Marathi',   label: 'Marathi',   flag: '🇮🇳', native: 'मराठी'     },
  { code: 'Bengali',   label: 'Bengali',   flag: '🇮🇳', native: 'বাংলা'     },
];

/* ── Context ── */
const LanguageContext = createContext({
  language: 'English',
  setLanguage: () => {},
  languages: LANGUAGES,
  currentLang: LANGUAGES[0],
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('vidhan_lang') || 'English';
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('vidhan_lang', lang);
  };

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languages: LANGUAGES, currentLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
