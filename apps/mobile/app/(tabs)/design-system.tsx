import { DesignSystemPage } from '@/pages';

/**
 * Design System Route
 * 라우팅만 담당, 화면 로직은 pages/design-system에서 처리
 */
const DesignSystemRoute = () => {
    return <DesignSystemPage />;
};

// Expo Router requires default export for route components
export default DesignSystemRoute;
