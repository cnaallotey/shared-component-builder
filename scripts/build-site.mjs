// Copies the built library and three.js into site/lib so the site works
// without a CDN. Run via `npm run site:build` (which runs `npm run build` first).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site', 'lib');

const files = [
  // [source, destination inside site/lib]
  ['dist/component-builder.umd.js', 'component-builder.umd.js'],
  ['dist/component-builder.umd.js.map', 'component-builder.umd.js.map'],
  ['node_modules/three/build/three.module.min.js', 'three.module.min.js'],
  ['node_modules/three/examples/jsm/environments/RoomEnvironment.js', 'addons/environments/RoomEnvironment.js'],
  ['node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js', 'addons/geometries/RoundedBoxGeometry.js'],
  ['node_modules/three/examples/jsm/geometries/TextGeometry.js', 'addons/geometries/TextGeometry.js'],
  ['node_modules/three/examples/jsm/loaders/FontLoader.js', 'addons/loaders/FontLoader.js'],
  ['node_modules/three/LICENSE', 'three.LICENSE.txt'],
  ['node_modules/three/examples/fonts/droid/NOTICE', 'fonts/droid-NOTICE.txt'],
];

for (const [source, destination] of files) {
  const from = join(root, source);
  if (!existsSync(from)) {
    console.error(`Missing ${source}. Run "npm install" and "npm run build" first.`);
    process.exit(1);
  }
  const to = join(outDir, destination);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
// The flip board only needs a few glyphs, so ship a subset of the font.
const FLIP_CHARS = 'defineexportimport()';
const fontSource = join(root, 'node_modules/three/examples/fonts/droid/droid_sans_mono_regular.typeface.json');
const font = JSON.parse(readFileSync(fontSource, 'utf8'));
font.glyphs = Object.fromEntries(
  Object.entries(font.glyphs).filter(([char]) => FLIP_CHARS.includes(char))
);
mkdirSync(join(outDir, 'fonts'), { recursive: true });
writeFileSync(join(outDir, 'fonts', 'flip-mono.typeface.json'), JSON.stringify(font));

console.log(`Copied ${files.length} files and a font subset to site/lib`);
