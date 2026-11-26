// A glossy 3D split-flap board that cascades between define(), export() and
// import(). Each tile is a lit, rounded block with an extruded glowing
// character on both faces; a flip turns the tile half a revolution.
// A mirrored pass under a translucent floor gives the reflection.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { runScene, ease, clamp01 } from './core.js';

const WORDS = ['define()', 'export()', 'import()'];
const CELLS = 8;
const TILE_W = 0.9;
const TILE_H = 1.24;
const TILE_D = 0.34;
const GAP = 0.13;
const HOLD = 3.4; // seconds each word stays up
const STAGGER = 0.065;
const FLIP = 0.75;

function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export async function mount(canvas, { fontUrl, onWord = () => {} } = {}) {
  const font = await new FontLoader().loadAsync(fontUrl);
  let api = null;

  // Clicking the board flips to the next call.
  let requestNext = false;
  canvas.addEventListener('click', () => {
    requestNext = true;
    if (api && !api.isRunning()) api.redraw();
  });

  api = runScene(
    canvas,
    ({ renderer }) => {
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.autoClear = false;

      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

      const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

      const key = new THREE.DirectionalLight('#ffffff', 1.2);
      key.position.set(-3, 5, 6);
      scene.add(key);

      // A coloured light that sweeps across with each flip wave
      const sweep = new THREE.PointLight('#22d3ee', 0, 7, 1.6);
      sweep.position.set(-6, 0.6, 1.6);
      scene.add(sweep);

      // Character geometries, built once per glyph and centred on the tile face
      const glyphs = new Map();
      const glyph = (char) => {
        if (!glyphs.has(char)) {
          const g = new TextGeometry(char, {
            font,
            size: 0.64,
            depth: 0.06,
            curveSegments: 8,
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.008,
            bevelSegments: 2,
          });
          g.computeBoundingBox();
          const bb = g.boundingBox;
          // Centre horizontally; keep one baseline so letters line up.
          g.translate(-(bb.min.x + bb.max.x) / 2, -0.24, 0);
          glyphs.set(char, g);
        }
        return glyphs.get(char);
      };

      const board = new THREE.Group();
      scene.add(board);

      const tileGeo = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 4, 0.11);
      const tileMat = new THREE.MeshStandardMaterial({ color: '#151a24', metalness: 0.75, roughness: 0.26 });
      const seamGeo = new THREE.BoxGeometry(TILE_W + 0.01, 0.016, TILE_D + 0.012);
      const seamMat = new THREE.MeshBasicMaterial({ color: '#040508' });
      const glowTex = glowTexture();
      const glowGeo = new THREE.PlaneGeometry(1.3, 1.3);

      const green = new THREE.Color('#4ade80');
      const cyan = new THREE.Color('#22d3ee');

      const cells = [];
      for (let i = 0; i < CELLS; i++) {
        const color = green.clone().lerp(cyan, i / (CELLS - 1));
        // Not tone-mapped, so the glow stays saturated instead of washing out.
        const charMat = new THREE.MeshStandardMaterial({
          color: color.clone().multiplyScalar(0.35),
          emissive: color,
          emissiveIntensity: 0.75,
          metalness: 0.1,
          roughness: 0.3,
          toneMapped: false,
        });
        const glowMat = new THREE.MeshBasicMaterial({
          map: glowTex,
          color,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        });

        const cell = new THREE.Group();
        cell.add(new THREE.Mesh(tileGeo, tileMat));
        cell.add(new THREE.Mesh(seamGeo, seamMat));

        const front = new THREE.Mesh(glyph(WORDS[0][i]), charMat);
        front.position.z = TILE_D / 2 - 0.01;
        const back = new THREE.Mesh(glyph(WORDS[0][i]), charMat);
        back.rotation.x = Math.PI; // upright once the tile has turned half a revolution
        back.position.z = -(TILE_D / 2 - 0.01);

        const frontGlow = new THREE.Mesh(glowGeo, glowMat);
        frontGlow.position.z = TILE_D / 2 + 0.004;
        const backGlow = new THREE.Mesh(glowGeo, glowMat);
        backGlow.rotation.x = Math.PI;
        backGlow.position.z = -(TILE_D / 2 + 0.004);

        cell.add(front, back, frontGlow, backGlow);
        cell.position.x = (i - (CELLS - 1) / 2) * (TILE_W + GAP);
        board.add(cell);
        cells.push({ cell, front, back, glowMat, charMat, turns: 0, from: 0, start: Infinity });
      }

      // Translucent floor drawn over the mirrored pass
      const floorScene = new THREE.Scene();
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 20),
        // Same colour as the card, so only the reflection under it is dimmed.
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(getComputedStyle(canvas.closest('.card') || document.body).backgroundColor),
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          toneMapped: false,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      const FLOOR_Y = -TILE_H / 2 - 0.12;
      floor.position.y = FLOOR_Y;
      floorScene.add(floor);

      let wordIndex = 0;
      let lastSwitch = 0;
      let sweepStart = -10;
      onWord(WORDS[0], 0);

      function flipTo(index, time) {
        wordIndex = index;
        lastSwitch = time;
        sweepStart = time;
        onWord(WORDS[index], index);
        cells.forEach((c, i) => {
          // Put the new character on whichever face is hidden right now.
          const hidden = c.turns % 2 === 0 ? c.back : c.front;
          hidden.geometry = glyph(WORDS[index][i]);
          c.from = c.turns;
          c.turns += 1;
          c.start = time + i * STAGGER;
        });
      }

      const pointer = new THREE.Vector2();
      const pointerTarget = new THREE.Vector2();
      canvas.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        pointerTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      });
      canvas.addEventListener('pointerleave', () => pointerTarget.set(0, 0));

      const boardWidth = CELLS * (TILE_W + GAP);

      return {
        resize(width, height) {
          camera.aspect = width / height;
          // Fit the board's width with some margin, at any aspect ratio.
          const vfov = THREE.MathUtils.degToRad(camera.fov);
          const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
          const fitWidth = (boardWidth + 0.5) / 2 / Math.tan(hfov / 2);
          const fitHeight = 2.5 / 2 / Math.tan(vfov / 2);
          const distance = Math.max(fitWidth, fitHeight);
          camera.position.set(0, distance * 0.16, distance);
          camera.lookAt(0, -0.25, 0);
          camera.updateProjectionMatrix();
        },

        frame(time, delta) {
          if (requestNext || (delta && time - lastSwitch > HOLD)) {
            requestNext = false;
            flipTo((wordIndex + 1) % WORDS.length, time);
          }

          pointer.lerp(pointerTarget, delta ? 1 - Math.pow(0.01, delta) : 1);
          board.rotation.y = pointer.x * 0.16;
          board.rotation.x = pointer.y * 0.08;

          cells.forEach((c, i) => {
            // Without animation (reduced motion), snap straight to the result.
            const k = delta ? clamp01((time - c.start) / FLIP) : 1;
            const turn = c.from + (k >= 1 ? 1 : ease.outBack(k)) * (c.turns - c.from);
            c.cell.rotation.x = turn * Math.PI;
            c.cell.position.y = delta ? Math.sin(time * 1.3 + i * 0.6) * 0.035 : 0;
            // Glow brightens while the tile is mid-flip.
            const flare = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
            c.glowMat.opacity = 0.2 + flare * 0.35;
            c.charMat.emissiveIntensity = 0.75 + flare * 0.6;
          });

          const sweepK = delta ? clamp01((time - sweepStart) / (FLIP + STAGGER * CELLS)) : 1;
          sweep.position.x = -6 + sweepK * 12;
          sweep.intensity = Math.sin(sweepK * Math.PI) * 9;

          renderer.clear();
          // Reflection: the board mirrored under the floor line
          board.scale.y = -1;
          board.position.y = FLOOR_Y * 2;
          renderer.render(scene, camera);
          board.scale.y = 1;
          board.position.y = 0;
          renderer.render(floorScene, camera);
          renderer.clearDepth();
          renderer.render(scene, camera);
        },
      };
    },
    { alpha: true }
  );
  return api;
}
