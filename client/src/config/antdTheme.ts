import { ThemeConfig, theme } from 'antd';

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#3b82f6',
    colorBgBase: '#ffffff',
    colorTextBase: '#0f2231',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 14,
    colorBorder: '#e5e8ef',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  components: {
    Layout: { bodyBg: '#f5f6fa', siderBg: '#0f2231' },
    Menu: { darkItemBg: '#0f2231', darkSubMenuItemBg: '#1a3a52', darkItemSelectedBg: '#1a3a52' },
    Card: { borderRadius: 12 },
    Modal: { borderRadiusLG: 16 },
    Steps: {
      colorPrimary: '#3b82f6',
      colorText: '#0f2231',
    },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#60a5fa',
    colorBgBase: '#0f172a',
    colorBgContainer: '#1e293b',
    colorBgElevated: '#263346',
    colorBgLayout: '#0f172a',
    colorTextBase: '#f1f5f9',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 14,
    colorBorder: '#334155',
  },
  components: {
    Layout: { bodyBg: '#0f172a', siderBg: '#0f172a' },
    Menu: { darkItemBg: '#0f172a', darkSubMenuItemBg: '#1e293b', darkItemSelectedBg: '#1e293b' },
    Card: { borderRadius: 12 },
    Modal: { borderRadiusLG: 16 },
    Button: {
      defaultShadow: 'none',
      primaryShadow: 'none',
      dangerShadow: 'none',
    },
  },
};
