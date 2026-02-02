/**
 * ThemeContainer - API 테마 CSS 변수를 자식 컴포넌트에 적용하는 래퍼
 * @description 각 페이지/화면에서 이 컴포넌트로 콘텐츠를 감싸면 동적 테마가 적용됨
 */

import React, { useMemo } from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { vars } from 'nativewind';
import { useTheme } from '../providers';

interface ThemeContainerProps extends ViewProps {
    children: React.ReactNode;
}

export const ThemeContainer: React.FC<ThemeContainerProps> = ({
    children,
    style,
    ...props
}) => {
    const { activeTheme, effectiveColorScheme } = useTheme();

    // Generate CSS variables from API theme
    const themeVars = useMemo(() => {
        if (!activeTheme?.current_version) return {};

        const colors = effectiveColorScheme === 'dark'
            ? activeTheme.current_version.dark_mode
            : activeTheme.current_version.light_mode;

        const cssVars: Record<string, string> = {};
        Object.entries(colors).forEach(([key, value]) => {
            cssVars[`--${key}`] = value as string;
        });

        console.log('[ThemeContainer] Applying', Object.keys(cssVars).length, 'CSS variables');
        return vars(cssVars);
    }, [activeTheme, effectiveColorScheme]);

    return (
        <View style={[styles.container, themeVars, style]} {...props}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
