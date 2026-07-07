import { useEffect } from 'react';
import { applyTheme, resolveTheme } from '../../theme/theme';
import { useUiStore } from '../store/uiStore';

export function useThemeSync(): void {
  const themePreference = useUiStore((s) => s.themePreference);

  useEffect(() => {
    applyTheme(resolveTheme(themePreference));

    if (themePreference !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(resolveTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [themePreference]);
}
