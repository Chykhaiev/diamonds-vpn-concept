// Bundles the site into one self-contained dist/index.html (JS + CSS inlined).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const esbuild = require('esbuild');
const V = '/home/claude/vendor';
const root = new URL('..', import.meta.url).pathname;

const vendorPlugin = {
  name: 'vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: `${V}/three/build/three.module.js` }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: `${V}/three/examples/jsm/${a.path.slice('three/addons/'.length)}` }));
    b.onResolve({ filter: /^gsap$/ }, () => ({ path: `${V}/gsap/esm/index.js` }));
    b.onResolve({ filter: /^gsap\// }, (a) => ({ path: `${V}/gsap/esm/${a.path.slice(5)}.js` }));
    b.onResolve({ filter: /^lenis$/ }, () => ({ path: `${V}/lenis/packages/core/index.ts` }));
  },
};

const res = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'esm', target: 'es2020', write: false,
  outdir: path.join(root, 'dist'), plugins: [vendorPlugin], legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
});
let js = '', css = '';
for (const f of res.outputFiles) { if (f.path.endsWith('.js')) js = f.text; else if (f.path.endsWith('.css')) css = f.text; }
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="\.\/src\/style\.css" \/>/, () => `<style>${css}</style>`);
html = html.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, () => `<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
