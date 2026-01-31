/**
 * 테마 적용 기본 컴포넌트
 * @description 다크/라이트 모드를 자동 적용하는 Text, View 컴포넌트
 * @layer shared/ui
 */

import { Text as DefaultText, View as DefaultView } from 'react-native';

import { themeColors } from '@/shared/theme/colors';
import { useColorScheme } from '@/shared/hooks/useColorScheme';

type ThemeProps = {
    lightColor?: string;
    darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export const useThemeColor = (
    props: { light?: string; dark?: string },
    colorName: keyof typeof themeColors.light
) => {
    const theme = useColorScheme() ?? 'light';
    const colorFromProps = props[theme];

    if (colorFromProps) {
        return colorFromProps;
    } else {
        return themeColors[theme][colorName];
    }
};

export const Text = (props: TextProps) => {
    const { style, lightColor, darkColor, ...otherProps } = props;
    const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

    return <DefaultText style={[{ color }, style]} {...otherProps} />;
};

export const View = (props: ViewProps) => {
    const { style, lightColor, darkColor, ...otherProps } = props;
    const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

    return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
};
