/**
 * Enterprise Theme Engine
 *
 * Converts a compact enterprise brand configuration into CSS custom-property
 * overrides that layer on top of the existing shadcn/ui design tokens defined
 * in globals.css.
 *
 * Features:
 * - Override primary, secondary, accent, success, warning, destructive colors
 * - Auto-generate readable foreground (white or black) for any background
 * - HSL translation for shadcn/ui compatibility
 * - Logo & favicon customization
 * - Serialise / deserialise for localStorage persistence
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnterpriseThemeConfig {
  /** Display name of the enterprise (used in UI chrome). */
  companyName?: string;
  /** URL to the company logo (light mode). */
  logoUrl?: string;
  /** URL to the company logo (dark mode — falls back to logoUrl). */
  logoDarkUrl?: string;
  /** URL to a custom favicon. */
  faviconUrl?: string;
  /** Primary brand colour (hex, e.g. "#1E40AF"). */
  primaryColor?: string;
  /** Secondary brand colour. */
  secondaryColor?: string;
  /** Accent colour. */
  accentColor?: string;
  /** Success state colour. */
  successColor?: string;
  /** Warning state colour. */
  warningColor?: string;
  /** Destructive / error colour. */
  destructiveColor?: string;
  /** Border-radius override (CSS value, e.g. "0.75rem"). */
  borderRadius?: string;
  /** Any arbitrary CSS to inject (escape-safe, no script). */
  customCSS?: string;
}

/** Pre-computed HSL triplets ready for CSS variables (space-separated). */
export interface ComputedThemeVars {
  [cssVarName: string]: string;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Parse a hex colour (3/6/8 digit) into { r, g, b } each 0–255. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length >= 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    return null;
  }

  return { r, g, b };
}

/** Convert RGB to HSL (returns "H S% L%" string for CSS variable). */
function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Convert hex to the "H S% L%" format used by shadcn CSS variables. */
export function hexToHsl(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/**
 * Determine whether white or black text provides better contrast against a
 * given background colour (WCAG relative luminance formula).
 */
export function contrastForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '0 0% 100%'; // default white

  // Relative luminance
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);

  // Light background → dark text; dark background → light text
  return L > 0.179 ? '222 47% 11%' : '0 0% 100%';
}

/**
 * Generate a lighter tint of a colour (for accent / muted surfaces).
 */
function lightenHex(hex: string, amount = 0.9): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = Math.round(rgb.r + (255 - rgb.r) * amount);
  const g = Math.round(rgb.g + (255 - rgb.g) * amount);
  const b = Math.round(rgb.b + (255 - rgb.b) * amount);
  return rgbToHsl(r, g, b);
}

// ---------------------------------------------------------------------------
// Theme Computation
// ---------------------------------------------------------------------------

/**
 * Compute CSS variable overrides from an enterprise theme config.
 * Only non-undefined fields produce overrides — the defaults in globals.css
 * remain untouched for anything not customized.
 */
export function computeThemeVars(config: EnterpriseThemeConfig): ComputedThemeVars {
  const vars: ComputedThemeVars = {};

  if (config.primaryColor) {
    const hsl = hexToHsl(config.primaryColor);
    if (hsl) {
      vars['--primary'] = hsl;
      vars['--primary-foreground'] = contrastForeground(config.primaryColor);
      vars['--ring'] = hsl;
      vars['--ai-primary'] = hsl;
      // Lighter tint for accent / sidebar
      const light = lightenHex(config.primaryColor, 0.92);
      if (light) {
        vars['--accent'] = light;
        vars['--sidebar-accent'] = light;
      }
    }
  }

  if (config.secondaryColor) {
    const hsl = hexToHsl(config.secondaryColor);
    if (hsl) {
      vars['--secondary'] = hsl;
      vars['--secondary-foreground'] = contrastForeground(config.secondaryColor);
      vars['--ai-secondary'] = hsl;
    }
  }

  if (config.accentColor) {
    const hsl = hexToHsl(config.accentColor);
    if (hsl) {
      vars['--accent'] = hsl;
      vars['--accent-foreground'] = contrastForeground(config.accentColor);
      vars['--ai-accent'] = hsl;
    }
  }

  if (config.successColor) {
    const hsl = hexToHsl(config.successColor);
    if (hsl) {
      vars['--success'] = hsl;
      vars['--success-foreground'] = contrastForeground(config.successColor);
      vars['--ai-success'] = hsl;
    }
  }

  if (config.warningColor) {
    const hsl = hexToHsl(config.warningColor);
    if (hsl) {
      vars['--warning'] = hsl;
      vars['--warning-foreground'] = contrastForeground(config.warningColor);
      vars['--ai-warning'] = hsl;
    }
  }

  if (config.destructiveColor) {
    const hsl = hexToHsl(config.destructiveColor);
    if (hsl) {
      vars['--destructive'] = hsl;
      vars['--destructive-foreground'] = contrastForeground(config.destructiveColor);
      vars['--ai-danger'] = hsl;
    }
  }

  if (config.borderRadius) {
    vars['--radius'] = config.borderRadius;
  }

  return vars;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

const STYLE_ID = 'enterprise-theme-overrides';

/**
 * Apply computed theme vars to the document root element.
 * Creates (or updates) a dedicated `<style>` tag so overrides can be
 * cleanly removed later without touching the original globals.css values.
 */
export function applyThemeToDOM(vars: ComputedThemeVars): void {
  if (typeof document === 'undefined') return;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  const declarations = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  style.textContent = `:root {\n${declarations}\n}\n`;
}

/**
 * Remove all enterprise theme overrides, reverting to the default palette.
 */
export function removeThemeFromDOM(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * Apply a custom favicon.
 */
export function applyFavicon(url: string): void {
  if (typeof document === 'undefined') return;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'contigo-enterprise-theme';

export function saveThemeConfig(config: EnterpriseThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

export function loadThemeConfig(): EnterpriseThemeConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EnterpriseThemeConfig) : null;
  } catch {
    return null;
  }
}

export function clearThemeConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
