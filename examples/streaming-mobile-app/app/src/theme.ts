/**
 * Terra design system tokens — matches the Terra dashboard so the demo
 * reads as a sibling app. Light theme; Poppins throughout.
 */

export const colors = {
  background: '#F8FAFF',
  card: '#FFFFFF',
  border: '#E0E0E0', // outline-grey
  text: '#1E293A', // default
  textDim: '#9193A3', // neutral
  textMid: '#49525F', // dark-neutral

  primary: '#008AFF',
  primaryHover: '#0079E0',

  failure: '#E02D3C',
  failureBg: '#FBE6E8',
  success: '#20BA4B',
  successBg: '#E4F7E9',
  warning: '#BB4D00',
  warningBg: '#FFFBEE',

  hoverBlue: '#F0F8FF',
  lightBlue: '#DEF0FF',
  terraBlue: '#bce0fe',
  sandWhite: '#FAFAF9',
  ghostBg: '#F3F4F6',

  // health status palette (HR zones etc.)
  good: '#34C759',
  ok: '#ff9f10',
  bad: '#EB5429',

  // semantic aliases used across components
  accent: '#E02D3C',
  green: '#20BA4B',
  yellow: '#BB4D00',
  blue: '#008AFF',
  orange: '#ff9f10',
  purple: '#7B61FF',
};

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
};

/** HR zone colour using the dashboard's good/ok/bad palette. */
export function hrColor(bpm: number | undefined): string {
  if (bpm === undefined) return colors.textDim;
  if (bpm < 100) return colors.good;
  if (bpm < 140) return colors.ok;
  return colors.bad;
}
