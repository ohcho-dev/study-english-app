/**
 * Color utility functions for theme manipulation
 * @description HEX 색상 조작 유틸리티 (밝게/어둡게)
 */

/**
 * HEX 색상을 밝게 만드는 함수
 * @param hex - HEX 색상 (#RRGGBB 또는 #RGB)
 * @param percent - 밝기 증가 비율 (0-100)
 * @returns 밝아진 HEX 색상
 */
export const lightenColor = (hex: string, percent: number): string => {
    // Validate and normalize hex
    let normalizedHex = hex.replace('#', '');

    // Handle shorthand (#RGB → #RRGGBB)
    if (normalizedHex.length === 3) {
        normalizedHex = normalizedHex
            .split('')
            .map((c) => c + c)
            .join('');
    }

    if (normalizedHex.length !== 6) {
        return hex; // Return original if invalid
    }

    // Parse RGB values
    const r = parseInt(normalizedHex.substring(0, 2), 16);
    const g = parseInt(normalizedHex.substring(2, 4), 16);
    const b = parseInt(normalizedHex.substring(4, 6), 16);

    // Calculate lightened values
    const lighten = (value: number): number => {
        const lightened = value + ((255 - value) * percent) / 100;
        return Math.min(255, Math.round(lightened));
    };

    const newR = lighten(r);
    const newG = lighten(g);
    const newB = lighten(b);

    // Convert back to hex
    const toHex = (n: number): string => n.toString(16).padStart(2, '0');

    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

/**
 * HEX 색상을 어둡게 만드는 함수
 * @param hex - HEX 색상 (#RRGGBB 또는 #RGB)
 * @param percent - 어둡기 증가 비율 (0-100)
 * @returns 어두워진 HEX 색상
 */
export const darkenColor = (hex: string, percent: number): string => {
    // Validate and normalize hex
    let normalizedHex = hex.replace('#', '');

    // Handle shorthand (#RGB → #RRGGBB)
    if (normalizedHex.length === 3) {
        normalizedHex = normalizedHex
            .split('')
            .map((c) => c + c)
            .join('');
    }

    if (normalizedHex.length !== 6) {
        return hex; // Return original if invalid
    }

    // Parse RGB values
    const r = parseInt(normalizedHex.substring(0, 2), 16);
    const g = parseInt(normalizedHex.substring(2, 4), 16);
    const b = parseInt(normalizedHex.substring(4, 6), 16);

    // Calculate darkened values
    const darken = (value: number): number => {
        const darkened = value * (1 - percent / 100);
        return Math.max(0, Math.round(darkened));
    };

    const newR = darken(r);
    const newG = darken(g);
    const newB = darken(b);

    // Convert back to hex
    const toHex = (n: number): string => n.toString(16).padStart(2, '0');

    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};
