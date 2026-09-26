// Renders the source images @capacitor/assets turns into every Android icon
// and splash size: `npm run android:icons`. Drawn from the same mark as
// src/components/Logo.jsx, so there is nothing binary to keep in sync by hand.

import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const NAVY = '#1B365D'
const CYAN = '#00B4D8'
const out = fileURLToPath(new URL('../assets/', import.meta.url))
mkdirSync(out, { recursive: true })

// The logo mark on a 64-unit grid: a cyan ring around a white "F".
const mark = (scale, cx, cy) => `
  <g transform="translate(${cx - 32 * scale} ${cy - 32 * scale}) scale(${scale})">
    <circle cx="32" cy="32" r="27" fill="none" stroke="${CYAN}" stroke-width="5"/>
    <path d="M25 20h16v6h-10v6h9v6h-9v12h-6z" fill="#FFFFFF"/>
  </g>`

const svg = (size, body, bg) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
  (bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : '') + body + '</svg>')

const png = (buf, name) => sharp(buf).png().toFile(out + name)

// Legacy square icon: mark fills most of the tile.
await png(svg(1024, mark(11, 512, 512), NAVY), 'icon-only.png')
// Adaptive icon: Android crops to a circle/squircle, keep the mark in the
// central safe zone (about 60% of the canvas).
await png(svg(1024, mark(8.5, 512, 512)), 'icon-foreground.png')
await png(svg(1024, '', NAVY), 'icon-background.png')
// Splash: the mark small and centred on navy.
await png(svg(2732, mark(9, 1366, 1366), NAVY), 'splash.png')
await png(svg(2732, mark(9, 1366, 1366), '#0f1e36'), 'splash-dark.png')

console.log('Wrote icon and splash sources to assets/')
