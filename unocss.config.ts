import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

// @unocss-include

export default defineConfig({
  shortcuts: [
    ['n-link', 'op50 hover:(op100 text-primary)'],
    ['n-link-text', 'n-link underline'],
    ['n-tab', 'text-xl tracking-wide uppercase p3 border-b-2 border-transparent op20'],
    ['n-tab-active', 'border-current op100'],
    ['border-base', 'border-gray-400/15'],
  ],
  theme: {
    colors: {
      // 影院感的琥珀金（上游原色为青绿 #40c1ad）
      primary: '#e0a437',
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
