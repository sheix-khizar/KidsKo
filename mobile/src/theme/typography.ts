import { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'Nunito_400Regular',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const fontSizes = {
  caption: 12,
  body: 14, // Minimum body size
  label: 16, // Minimum child-facing label
  subheading: 18,
  heading: 22,
  title: 26,
  hero: 32,
} as const;

export const typography: Record<string, TextStyle> = {
  hero: {
    fontFamily: fontFamilies.black,
    fontSize: fontSizes.hero,
    lineHeight: 38,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: fontSizes.title,
    lineHeight: 32,
  },
  heading: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.heading,
    lineHeight: 28,
  },
  subheading: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.subheading,
    lineHeight: 24,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.label,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamilies.semiBold,
    fontSize: fontSizes.body,
    lineHeight: 20,
  },
  bodyRegular: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.body,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.semiBold,
    fontSize: fontSizes.caption,
    lineHeight: 16,
  },
};

export type NunitoWeight = '400' | '600' | '700' | '800' | '900' | 'normal' | 'bold';

export function nunito(weight: NunitoWeight = '600'): { fontFamily: string } {
  switch (weight) {
    case '900':
      return { fontFamily: fontFamilies.black };
    case '800':
      return { fontFamily: fontFamilies.extraBold };
    case '700':
    case 'bold':
      return { fontFamily: fontFamilies.bold };
    case '600':
      return { fontFamily: fontFamilies.semiBold };
    case '400':
    case 'normal':
    default:
      return { fontFamily: fontFamilies.regular };
  }
}
