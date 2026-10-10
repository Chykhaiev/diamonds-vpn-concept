// Builds a 360x180 land/ocean bitmask from Natural Earth 110m land polygons for the particle globe.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { geoContains } = require('d3-geo');
const land = JSON.parse(fs.readFileSync('/home/claude/vendor/ne/geojson/ne_110m_land.geojson'));
const W = 360, H = 180;
const bytes = new Uint8Array((W * H) / 8);
let n = 0;
for (let y = 0; y < H; y++) {
  const lat = 90 - (y + 0.5);
  for (let x = 0; x < W; x++) {
    const lon = -180 + (x + 0.5);
    if (geoContains(land, [lon, lat])) { const i = y * W + x; bytes[i >> 3] |= 1 << (i & 7); n++; }
  }
}
fs.writeFileSync(new URL('../src/landmask.js', import.meta.url),
  `// 360x180 land mask (1 bit per cell), generated from Natural Earth 110m land.\nexport const LAND_W = ${W}, LAND_H = ${H};\nexport const LAND_B64 = '${Buffer.from(bytes).toString('base64')}';\n`);
console.log('land cells', n, 'of', W * H);
