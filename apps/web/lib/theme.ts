/**
 * Turns the shared design tokens in @reached/core into CSS custom properties.
 * This is the only place the web app gets colours, spacing, radius and type
 * from; globals.css refers to the variables only.
 */
import { dark, light, palette, radius, spacing, TOUCH_TARGET, typeScale } from '@reached/core';
import type { ColorScheme } from '@reached/core';

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function colorVars(c: ColorScheme): string {
  return Object.entries(c)
    .map(([k, v]) => `--c-${kebab(k)}:${v};`)
    .join('');
}

/** Pastel wash behind pages, built from the palette's soft tints. */
const lightWash = `--wash-1:${palette.green100};--wash-2:${palette.blue50};--wash-3:${palette.lilac50};--wash-base:${light.background};`;
const darkWash = `--wash-1:${dark.primarySoft};--wash-2:${dark.infoSoft};--wash-3:${palette.ink850};--wash-base:${dark.background};`;

function scaleVars(): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(spacing)) parts.push(`--space-${k}:${v}px;`);
  for (const [k, v] of Object.entries(radius)) parts.push(`--radius-${k}:${v}px;`);
  for (const [k, v] of Object.entries(typeScale)) {
    parts.push(`--fs-${k}:${v.fontSize}px;--lh-${k}:${v.lineHeight}px;`);
    // 'PlusJakartaSans_600SemiBold' → 600
    const weight = Number(/_(\d{3})/.exec(v.fontFamily)?.[1] ?? 400);
    parts.push(`--fw-${k}:${weight};`);
    if ('letterSpacing' in v) parts.push(`--ls-${k}:${v.letterSpacing}px;`);
  }
  parts.push(`--touch:${TOUCH_TARGET}px;`);
  parts.push(`--sos:${palette.red500};`);
  return parts.join('');
}

export const themeCss = [
  `:root{${colorVars(light)}${lightWash}${scaleVars()}color-scheme:light;}`,
  `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${colorVars(dark)}${darkWash}color-scheme:dark;}}`,
  `:root[data-theme="dark"]{${colorVars(dark)}${darkWash}color-scheme:dark;}`,
].join('\n');

/** Runs before first paint: applies the saved theme and the in-app embed mode. */
export const THEME_STORAGE_KEY = 'reached-theme';
export const bootScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')d.setAttribute('data-theme',t);}catch(e){}try{if(new URLSearchParams(location.search).get('embed')==='1')d.setAttribute('data-embed','1');}catch(e){}})();`;
