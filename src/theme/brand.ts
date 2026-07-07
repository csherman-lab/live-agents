
export const USER_COLOR = '#007AFF';

export const USER_COLOR_LIGHT = `${USER_COLOR}1A`;
export const USER_COLOR_SOFT = `${USER_COLOR}33`;
export const USER_COLOR_MEDIUM = `${USER_COLOR}80`;

export const APPLE_BLUE = '#007AFF';
export const APPLE_GRAY = '#8E8E93';
export const APPLE_BG = 'var(--apple-bg)';
export const APPLE_SURFACE = 'var(--apple-surface)';
export const APPLE_TEXT = 'var(--apple-text)';
export const APPLE_TEXT_SECONDARY = 'var(--apple-text-secondary)';

export function withHexAlpha(hex: string, alpha = '1A'): string {
  return hex.length === 7 && hex.startsWith('#') ? `${hex}${alpha}` : hex;
}
