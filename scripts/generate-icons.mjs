// Renders the app icon, splash image, Android adaptive icon layers and favicon from SVG.
// Run: node scripts/generate-icons.mjs   (placeholder branding until real artwork exists)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

const egg = (fill = 'url(#egg)', stroke = '#E7C9A5') => `
  <path d="M512 210 C690 210 800 470 800 620 C800 790 670 880 512 880 C354 880 224 790 224 620 C224 470 334 210 512 210 Z"
        fill="${fill}" stroke="${stroke}" stroke-width="10"/>
  <circle cx="380" cy="660" r="44" fill="#FFC4DB"/>
  <circle cx="650" cy="520" r="56" fill="#FFC4DB"/>
  <circle cx="600" cy="770" r="32" fill="#FFC4DB"/>
  <path d="M440 300 L512 380 L470 440 L560 520" stroke="#7A5333" stroke-width="22" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>`;

const star = (x, y, r, fill) => {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(`${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="#E09A00" stroke-width="8" stroke-linejoin="round"/>`;
};

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFD1E2"/>
      <stop offset="1" stop-color="#FFE9C7"/>
    </linearGradient>
    <radialGradient id="egg" cx="0.38" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.45" stop-color="#FFF6E0"/>
      <stop offset="1" stop-color="#F3D9B5"/>
    </radialGradient>
  </defs>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="560" r="400" fill="#FFFFFF" opacity="0.35"/>
  ${egg()}
  ${star(760, 250, 120, '#FFC93C')}
</svg>`;

const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  <g transform="translate(512 540) scale(0.62) translate(-512 -540)">${egg()}${star(760, 250, 120, '#FFC93C')}</g>
</svg>`;

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${defs}<rect width="1024" height="1024" fill="url(#bg)"/></svg>`;

const monochrome = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 540) scale(0.62) translate(-512 -540)">
    <path d="M512 210 C690 210 800 470 800 620 C800 790 670 880 512 880 C354 880 224 790 224 620 C224 470 334 210 512 210 Z" fill="#000000"/>
  </g>
</svg>`;

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  ${egg()}
  ${star(760, 250, 120, '#FFC93C')}
</svg>`;

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(out, file), png);
}

render(icon, 1024, 'icon.png');
render(foreground, 1024, 'android-icon-foreground.png');
render(background, 1024, 'android-icon-background.png');
render(monochrome, 1024, 'android-icon-monochrome.png');
render(splash, 512, 'splash-icon.png');
render(icon, 48, 'favicon.png');
console.log('Icons written to', out);
