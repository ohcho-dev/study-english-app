/**
 * Pretendard 폰트 설정
 * @description 앱 전체에서 사용하는 폰트 정의
 * @layer shared/config
 */

export const fonts = {
    'Pretendard-Thin': require('../../assets/fonts/PretendardStd-Thin.otf'),
    'Pretendard-ExtraLight': require('../../assets/fonts/PretendardStd-ExtraLight.otf'),
    'Pretendard-Light': require('../../assets/fonts/PretendardStd-Light.otf'),
    'Pretendard-Regular': require('../../assets/fonts/PretendardStd-Regular.otf'),
    'Pretendard-Medium': require('../../assets/fonts/PretendardStd-Medium.otf'),
    'Pretendard-SemiBold': require('../../assets/fonts/PretendardStd-SemiBold.otf'),
    'Pretendard-Bold': require('../../assets/fonts/PretendardStd-Bold.otf'),
    'Pretendard-ExtraBold': require('../../assets/fonts/PretendardStd-ExtraBold.otf'),
    'Pretendard-Black': require('../../assets/fonts/PretendardStd-Black.otf'),
} as const;

// 폰트 이름 타입 (자동완성 지원)
export type FontFamily = keyof typeof fonts;

// 자주 사용하는 폰트 단축 참조
export const fontFamily = {
    thin: 'Pretendard-Thin',
    extraLight: 'Pretendard-ExtraLight',
    light: 'Pretendard-Light',
    regular: 'Pretendard-Regular',
    medium: 'Pretendard-Medium',
    semiBold: 'Pretendard-SemiBold',
    bold: 'Pretendard-Bold',
    extraBold: 'Pretendard-ExtraBold',
    black: 'Pretendard-Black',
} as const;
