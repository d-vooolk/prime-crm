import { ThemeConfig, theme } from 'antd';

// Фирменный стиль prime-auto.by: салатовый #A2DB00 на графите, Montserrat в заголовках (через CSS, global.scss).
// Значения повторяют CSS-переменные из styles/_theme.scss — antd нужны строки, а не var().
const BRAND = '#A2DB00';
const ON_BRAND = '#121212';
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Поля ввода — свой фон и рамка, чтобы значение было хорошо видно и на карточке, и в модалке */
const fieldTokens = (bg: string, border: string, hoverBorder: string) => ({
  colorBgContainer: bg,
  colorBorder: border,
  hoverBorderColor: hoverBorder,
  activeBorderColor: BRAND,
});

/** Общее для обеих тем: тёмный текст на салатовом, скругления как на странице записи */
const commonComponents = (field: ReturnType<typeof fieldTokens>): ThemeConfig['components'] => ({
  Button: {
    primaryColor: ON_BRAND,
    fontWeight: 600,
    defaultShadow: 'none',
    primaryShadow: 'none',
    dangerShadow: 'none',
    controlHeight: 36,
  },
  Input: field,
  InputNumber: field,
  Select: { ...field, optionSelectedFontWeight: 600 },
  TreeSelect: field,
  Cascader: field,
  DatePicker: { ...field, cellActiveWithRangeBg: 'rgba(162, 219, 0, 0.18)' },
  Mentions: field,
  Checkbox: { colorWhite: ON_BRAND },
  Radio: { buttonSolidCheckedColor: ON_BRAND, dotSize: 8 },
  Steps: { colorTextLightSolid: ON_BRAND },
  Card: { borderRadiusLG: 18 },
  Modal: { borderRadiusLG: 22, titleFontSize: 18 },
  Tabs: { inkBarColor: BRAND, titleFontSize: 14 },
  Segmented: { itemSelectedColor: ON_BRAND, itemSelectedBg: BRAND },
  Tooltip: { colorTextLightSolid: '#ffffff' },
  Statistic: { contentFontSize: 26 },
});

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND,
    // Салатовый на белом не читается текстом — ссылки и выбранные пункты темнее
    colorPrimaryText: '#4d7300',
    colorPrimaryTextHover: '#5e8c00',
    colorPrimaryTextActive: '#3f5e00',
    colorLink: '#4d7300',
    colorLinkHover: '#5e8c00',
    colorLinkActive: '#3f5e00',
    colorSuccess: '#5e9e00',
    colorInfo: '#0284c7',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorBgBase: '#ffffff',
    colorBgLayout: '#f2f3ef',
    colorTextBase: '#151515',
    colorBorder: '#d4d7cc',
    colorBorderSecondary: '#e2e4dc',
    colorTextPlaceholder: '#8a8f84',
    borderRadius: 10,
    fontFamily: FONT,
    fontSize: 14,
    boxShadow: '0 8px 22px rgba(0,0,0,0.08)',
  },
  components: {
    ...commonComponents(fieldTokens('#ffffff', '#d4d7cc', '#9fb36a')),
    Layout: { bodyBg: '#f2f3ef', siderBg: '#141414' },
    Tabs: { inkBarColor: BRAND, titleFontSize: 14, itemSelectedColor: '#151515', itemHoverColor: '#4d7300', itemActiveColor: '#151515' },
    Table: { headerBg: '#f4f5f1', rowHoverBg: '#f7faee' },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: BRAND,
    colorLink: BRAND,
    colorLinkHover: '#b5ea1a',
    colorLinkActive: '#8fc200',
    colorSuccess: BRAND,
    colorInfo: '#38bdf8',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorBgBase: '#121212',
    colorBgLayout: '#121212',
    colorBgContainer: '#1c1c1c',
    colorBgElevated: '#232323',
    colorTextBase: '#ffffff',
    colorBorder: '#3a3a3a',
    colorBorderSecondary: 'rgba(255,255,255,0.08)',
    // На тёмном antd делает подсказки и заблокированные поля слишком тусклыми
    colorTextPlaceholder: '#7d7d7d',
    colorTextDisabled: '#8f8f8f',
    colorTextDescription: '#a3a3a3',
    borderRadius: 10,
    fontFamily: FONT,
    fontSize: 14,
  },
  components: {
    ...commonComponents(fieldTokens('#262626', '#3a3a3a', '#5a6a2a')),
    Layout: { bodyBg: '#121212', siderBg: '#161616' },
    // Модалка темнее полей: поле ввода выделяется на её фоне
    Modal: { borderRadiusLG: 22, titleFontSize: 18, contentBg: '#1a1a1a', headerBg: '#1a1a1a', footerBg: '#1a1a1a' },
    Drawer: { colorBgElevated: '#1a1a1a' },
    Table: { headerBg: '#202020', rowHoverBg: '#222a14', borderColor: 'rgba(255,255,255,0.07)' },
  },
};
