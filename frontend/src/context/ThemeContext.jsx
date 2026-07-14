import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vidhan_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vidhan_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transitioning');
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
