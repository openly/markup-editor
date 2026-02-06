import type { ThemeColors, ThemeMode } from '../types';

export const lightTheme: ThemeColors = {
  background: '#f3f4f6',
  surface: '#ffffff',
  surfaceHover: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  canvasBackground: '#1f2937',
  toolbarBackground: '#ffffff',
  panelBackground: '#f9fafb',
};

export const darkTheme: ThemeColors = {
  background: '#111827',
  surface: '#1f2937',
  surfaceHover: '#374151',
  border: '#374151',
  text: '#f9fafb',
  textMuted: '#9ca3af',
  primary: '#3b82f6',
  primaryHover: '#60a5fa',
  canvasBackground: '#0f172a',
  toolbarBackground: '#1f2937',
  panelBackground: '#1f2937',
};

export function getTheme(mode: ThemeMode): ThemeColors {
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? darkTheme : lightTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
}

export function applyTheme(container: HTMLElement, colors: ThemeColors): void {
  const style = container.style;
  style.setProperty('--me-bg', colors.background);
  style.setProperty('--me-surface', colors.surface);
  style.setProperty('--me-surface-hover', colors.surfaceHover);
  style.setProperty('--me-border', colors.border);
  style.setProperty('--me-text', colors.text);
  style.setProperty('--me-text-muted', colors.textMuted);
  style.setProperty('--me-primary', colors.primary);
  style.setProperty('--me-primary-hover', colors.primaryHover);
  style.setProperty('--me-canvas-bg', colors.canvasBackground);
  style.setProperty('--me-toolbar-bg', colors.toolbarBackground);
  style.setProperty('--me-panel-bg', colors.panelBackground);
}

export function watchSystemTheme(callback: (isDark: boolean) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
