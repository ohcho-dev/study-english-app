/**
 * 컬러 스킴 훅
 * @description 앱 테마 설정에 따른 컬러 스킴 반환
 */

import { useColorScheme as useSystemColorScheme } from 'react-native';
import { APP_THEME } from '@/lib/constants';

/**
 * 앱 테마 설정에 따른 컬러 스킴 반환
 * - APP_THEME 값을 변경하면 앱 전체 테마가 변경됨
 * - 'system' 설정 시 기기 설정을 따름
 */
export const useColorScheme = (): 'light' | 'dark' => {
    const systemScheme = useSystemColorScheme();

    if (APP_THEME === 'system') {
        return systemScheme ?? 'dark';
    }

    return APP_THEME;
};

// 시스템 설정을 직접 사용하고 싶을 때
export { useSystemColorScheme };
