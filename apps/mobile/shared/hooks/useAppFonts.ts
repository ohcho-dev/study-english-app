/**
 * 앱 폰트 로딩 훅
 * @description Pretendard 폰트를 로드하는 커스텀 훅
 * @layer shared/hooks
 */

import { useFonts } from 'expo-font';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { fonts } from '@/shared/config/fonts';

export const useAppFonts = () => {
    return useFonts({
        ...fonts,
        ...FontAwesome.font,
    });
};
