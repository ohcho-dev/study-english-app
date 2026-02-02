/**
 * Screen - 화면 전체를 감싸는 컨테이너 컴포넌트
 * @description API 테마의 배경색을 자동으로 적용
 */

import React from 'react';
import { View, ScrollView, type ViewProps, type ScrollViewProps } from 'react-native';
import { cn } from '@/shared/reusables/lib/utils';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

export interface ScreenProps extends ViewProps {
    /** 스크롤 가능 여부 */
    scrollable?: boolean;
    /** ScrollView props (scrollable=true일 때 사용) */
    scrollViewProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;
    /** 내부 패딩 적용 여부 */
    padded?: boolean;
    /** 상단 SafeArea 패딩 적용 */
    safeTop?: boolean;
    /** 하단 SafeArea 패딩 적용 */
    safeBottom?: boolean;
}

/**
 * Screen 컴포넌트
 * 
 * @example
 * // 기본 사용
 * <Screen>
 *   <Text>내용</Text>
 * </Screen>
 * 
 * @example
 * // 스크롤 가능한 화면
 * <Screen scrollable padded safeTop>
 *   <Text>스크롤 가능한 내용</Text>
 * </Screen>
 */
export const Screen: React.FC<ScreenProps> = ({
    children,
    scrollable = false,
    scrollViewProps,
    padded = false,
    safeTop = false,
    safeBottom = false,
    className,
    style,
    ...props
}) => {
    const colors = useThemeColors();

    const containerStyle = {
        backgroundColor: colors.background,
    };

    const paddingClasses = cn(
        padded && 'px-4',
        safeTop && 'pt-16',
        safeBottom && 'pb-8',
    );

    if (scrollable) {
        return (
            <ScrollView
                className={cn('flex-1', paddingClasses, className)}
                style={[containerStyle, style]}
                showsVerticalScrollIndicator={false}
                {...scrollViewProps}
            >
                {children}
            </ScrollView>
        );
    }

    return (
        <View
            className={cn('flex-1', paddingClasses, className)}
            style={[containerStyle, style]}
            {...props}
        >
            {children}
        </View>
    );
};
