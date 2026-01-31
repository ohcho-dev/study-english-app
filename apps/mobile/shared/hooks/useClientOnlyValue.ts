/**
 * 클라이언트 전용 값 훅
 * @description 웹에서 서버/클라이언트 렌더링 분기 처리
 * @layer shared/hooks
 */

// This function is web-only as native doesn't currently support server (or build-time) rendering.
export const useClientOnlyValue = <S, C>(server: S, client: C): S | C => {
    return client;
};
