import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { useTheme } from '../context/ThemeContext';

const { darkAlgorithm, defaultAlgorithm } = antdTheme;

const SHARED = {
  colorPrimary:   '#6366f1',
  colorLink:      '#6366f1',
  colorSuccess:   '#10b981',
  colorWarning:   '#f59e0b',
  colorError:     '#ef4444',
  fontFamily:     "'Inter', 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize:       14,
  borderRadius:   8,
  borderRadiusLG: 10,
  borderRadiusSM: 6,
  motion:         true,
  wireframe:      false,
};

const DARK_TOKENS = {
  ...SHARED,
  colorBgBase:         '#030712',
  colorBgContainer:    '#0f172a',
  colorBgElevated:     '#1e293b',
  colorBgLayout:       '#030712',
  colorBgSpotlight:    '#1e293b',
  colorText:           '#f1f5f9',
  colorTextSecondary:  '#94a3b8',
  colorTextTertiary:   '#64748b',
  colorTextQuaternary: '#475569',
  colorBorder:         'rgba(255,255,255,0.1)',
  colorBorderSecondary:'rgba(255,255,255,0.06)',
  colorFill:           'rgba(255,255,255,0.06)',
  colorFillSecondary:  'rgba(255,255,255,0.04)',
  colorFillTertiary:   'rgba(255,255,255,0.02)',
  colorFillQuaternary: 'rgba(255,255,255,0.01)',
  boxShadow:           '0 6px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
  boxShadowSecondary:  '0 3px 12px rgba(0,0,0,0.4)',
};

const LIGHT_TOKENS = {
  ...SHARED,
  colorBgBase:         '#ffffff',
  colorBgContainer:    '#ffffff',
  colorBgElevated:     '#ffffff',
  colorBgLayout:       '#f6f7f9',
  colorBgSpotlight:    '#ffffff',
  colorText:           '#18181b',
  colorTextSecondary:  '#3f3f46',
  colorTextTertiary:   '#71717a',
  colorTextQuaternary: '#a1a1aa',
  colorBorder:         '#e4e4e7',
  colorBorderSecondary:'#f4f4f5',
  colorFill:           '#f4f4f5',
  colorFillSecondary:  '#fafafa',
  colorFillTertiary:   '#fefefe',
  colorFillQuaternary: '#ffffff',
  boxShadow:           '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
  boxShadowSecondary:  '0 2px 8px rgba(0,0,0,0.06)',
};

export default function AntdProvider({ children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
        token: isDark ? DARK_TOKENS : LIGHT_TOKENS,
        components: {
          Button: {
            primaryShadow:       isDark ? '0 4px 14px rgba(99,102,241,0.4)' : '0 3px 10px rgba(99,102,241,0.22)',
            defaultShadow:       isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
            defaultBg:           isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
            defaultBorderColor:  isDark ? 'rgba(255,255,255,0.12)' : '#d4d4d8',
            defaultColor:        isDark ? '#e2e8f0' : '#3f3f46',
            ghostBg:             'transparent',
            colorPrimaryHover:   '#4f46e5',
            colorPrimaryActive:  '#4338ca',
            contentFontSize:     14,
            contentFontSizeLG:   15,
            contentFontSizeSM:   13,
            paddingBlock:        8,
            paddingBlockLG:      10,
            paddingBlockSM:      5,
            paddingInline:       20,
            paddingInlineLG:     24,
            paddingInlineSM:     14,
          },
          Input: {
            colorBgContainer:   isDark ? '#0f172a' : '#ffffff',
            colorBorder:        isDark ? 'rgba(255,255,255,0.1)' : '#d4d4d8',
            colorText:          isDark ? '#f1f5f9' : '#18181b',
            colorTextPlaceholder: isDark ? '#475569' : '#a1a1aa',
            activeShadow:       `0 0 0 3px ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)'}`,
          },
          Select: {
            colorBgContainer: isDark ? '#0f172a' : '#ffffff',
          },
          Card: {
            colorBgContainer: isDark ? '#0f172a' : '#ffffff',
            boxShadow: isDark
              ? '0 4px 24px rgba(0,0,0,0.4)'
              : '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
