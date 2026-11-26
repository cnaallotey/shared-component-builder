// "How it works": a component cube assembles (Define), unfolds into a JSON file
// (Export), and the file flies to Project B where the cube appears (Import).
// Follows the `scb:step` event sent by the step tabs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runScene, labelTexture, glyphTexture, ease, clamp01 } from './core.js';

const PROJECT_A = '#2f6bff';
const PROJECT_B = '#ffb224';

function jsonTexture() {
  const w = 512;
  const h = 640;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 48);
  ctx.fill();
  ctx.fillStyle = '#eef1f4';
  ctx.fillRect(0, 0, w, 90);
  ctx.fillStyle = '#16181d';
  ctx.font = '600 40px "Geist Mono", ui-monospace, monospace';
  ctx.fillText('tally-counter.json', 36, 60);
  const lines = [
    ['{', '#16181d'],
    ['  "name": "tally-counter",', '#2f6bff'],
    ['  "props": ["label"],', '#2f6bff'],
    ['  "template": "(p, s) => …",', '#0f9f73'],
    ['  "styles": ":host { … }",', '#0f9f73'],
    ['  "methods": { … }', '#b7791f'],
    ['}', '#16181d'],
  ];
  ctx.font = '400 30px "Geist Mono", ui-monospace, monospace';
  lines.forEach(([text, color], i) => {
    ctx.fillStyle = color;
    ctx.fillText(text, 36, 160 + i * 62);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function mount(canvas, { eventTarget = window } = {}) {
  return runScene(
    canvas,
    ({ renderer }) => {
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
      camera.position.set(0, 2.2, 9);
      camera.lookAt(0, 0.2, 0);

      const light = new THREE.DirectionalLight('#ffffff', 1.2);
      light.position.set(3, 6, 5);
      scene.add(light, new THREE.AmbientLight('#ffffff', 0.4));

      // Two project pads joined by a dashed path
      function makePad(label, color, x) {
        const group = new THREE.Group();
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.9, 0.16, 64),
          new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.05 })
        );
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.86, 0.035, 12, 64),
          new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.2 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.08;
        const { texture, aspect } = labelTexture(label, { dot: color, bg: 'rgba(255,255,255,0.95)' });
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
        sprite.scale.set(0.36 * aspect, 0.36, 1);
        sprite.position.set(0, -0.55, 0.6);
        group.add(pad, rim, sprite);
        group.position.set(x, -0.6, 0);
        group.userData.rim = rim;
        scene.add(group);
        return group;
      }
      const padA = makePad('Project A', PROJECT_A, -2.6);
      const padB = makePad('Project B', PROJECT_B, 2.6);

      const pathPoints = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pathPoints.push(new THREE.Vector3(-2.6 + 5.2 * t, -0.5 + Math.sin(t * Math.PI) * 1.1, 0));
      }
      const path = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pathPoints),
        new THREE.LineDashedMaterial({ color: '#9aa4b2', dashSize: 0.12, gapSize: 0.1 })
      );
      path.computeLineDistances();
      scene.add(path);

      const cubeGeo = new RoundedBoxGeometry(1, 1, 1, 4, 0.16);
      const cubeMat = new THREE.MeshStandardMaterial({
        map: glyphTexture({ bg: PROJECT_A }),
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
      });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)),
        new THREE.LineBasicMaterial({ color: PROJECT_A, transparent: true })
      );
      const cubeGroup = new THREE.Group();
      cubeGroup.add(cube, edges);
      scene.add(cubeGroup);

      const cubeB = new THREE.Mesh(cubeGeo, cubeMat.clone());
      cubeB.material.transparent = false;
      scene.add(cubeB);

      const file = new THREE.Mesh(
        new THREE.PlaneGeometry(1.25, 1.56),
        new THREE.MeshStandardMaterial({ map: jsonTexture(), roughness: 0.5, transparent: true, side: THREE.DoubleSide })
      );
      scene.add(file);

      // Little "{ }" sparks while exporting
      const sparkCount = 40;
      const sparkGeo = new THREE.BufferGeometry();
      const sparkPos = new Float32Array(sparkCount * 3);
      const sparkSeed = new Float32Array(sparkCount).map(() => Math.random());
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
      const sparks = new THREE.Points(
        sparkGeo,
        new THREE.PointsMaterial({ color: PROJECT_A, size: 0.06, transparent: true, depthWrite: false })
      );
      scene.add(sparks);

      let step = 0;
      let clock = 10;
      eventTarget.addEventListener('scb:step', (e) => {
        step = e.detail.index;
        clock = 0;
      });

      const home = new THREE.Vector3(-2.6, 0.12, 0);
      const center = new THREE.Vector3(0, 0.55, 0);

      return {
        resize(width, height) {
          camera.aspect = width / height;
          // Pull back on narrow canvases so both pads stay in view.
          camera.position.z = THREE.MathUtils.clamp(7.4 * (1.55 / camera.aspect), 6.8, 14);
          camera.updateProjectionMatrix();
        },
        frame(time, delta) {
          clock += delta || 10;
          const t = clock;
          const bob = Math.sin(time * 1.6) * 0.06;

          padA.userData.rim.material.emissiveIntensity = step === 0 ? 0.6 : 0.2;
          padB.userData.rim.material.emissiveIntensity = step === 2 ? 0.25 + clamp01((t - 1.1) / 0.4) * 0.6 : 0.2;

          // Defaults
          cubeB.visible = false;
          file.visible = false;
          sparks.visible = false;
          cubeGroup.visible = true;

          if (step === 0) {
            // Define: edges draw in, then the solid fills them, on Project A's side.
            const k = ease.outCubic(clamp01(t / 1.2));
            cubeGroup.position.copy(center);
            cubeGroup.position.y += bob;
            cubeGroup.rotation.set(0.35, time * 0.6, 0);
            cubeGroup.scale.setScalar(0.6 + 0.4 * k);
            edges.material.opacity = 1 - k * 0.75;
            cubeMat.opacity = clamp01((t - 0.3) / 0.8);
          } else if (step === 1) {
            // Export: the cube steps back and a JSON file slides out of it.
            const k = ease.outBack(clamp01(t / 0.9));
            cubeGroup.position.set(-0.9, center.y + bob * 0.5, -0.4);
            cubeGroup.rotation.set(0.35, time * 0.6, 0);
            cubeGroup.scale.setScalar(0.72);
            edges.material.opacity = 0.2;
            cubeMat.opacity = 1;
            file.visible = true;
            file.position.set(-0.9 + 1.7 * k, center.y + 0.15 + bob, 0.3);
            file.rotation.set(0, -0.25 + Math.sin(time * 0.8) * 0.08, Math.sin(time) * 0.03);
            file.scale.setScalar(0.3 + 0.7 * k);
            file.material.opacity = clamp01(t / 0.4);
            sparks.visible = true;
            for (let i = 0; i < sparkCount; i++) {
              const life = (time * 0.6 + sparkSeed[i]) % 1;
              sparkPos[i * 3] = -0.9 + life * 1.8 + Math.sin(sparkSeed[i] * 20) * 0.2;
              sparkPos[i * 3 + 1] = center.y + Math.sin(life * Math.PI) * 0.7 + (sparkSeed[i] - 0.5) * 0.5;
              sparkPos[i * 3 + 2] = (sparkSeed[i] - 0.5) * 0.6;
            }
            sparkGeo.attributes.position.needsUpdate = true;
          } else {
            // Import: the file flies along the path to Project B, then the cube appears there.
            const fly = ease.inOutCubic(clamp01(t / 1.1));
            cubeGroup.position.set(home.x, home.y + 0.45 + bob * 0.5, 0);
            cubeGroup.rotation.set(0.2, time * 0.5, 0);
            cubeGroup.scale.setScalar(0.62);
            edges.material.opacity = 0.15;
            cubeMat.opacity = 1;
            if (fly < 1) {
              file.visible = true;
              const p = new THREE.Vector3(-0.8 + 3.4 * fly, 0.7 + Math.sin(fly * Math.PI) * 0.8, 0.2);
              file.position.copy(p);
              file.rotation.set(0, fly * Math.PI * 2, 0);
              file.scale.setScalar(0.8 - fly * 0.55);
              file.material.opacity = 1 - Math.max(0, fly - 0.85) / 0.15;
            }
            const pop = clamp01((t - 1.0) / 0.6);
            if (pop > 0) {
              cubeB.visible = true;
              cubeB.position.set(2.6, -0.48 + 0.6 * 0.62 + bob * 0.5 + 0.08, 0);
              cubeB.scale.setScalar(0.62 * ease.outBack(pop));
              cubeB.rotation.set(0.2, time * 0.5, 0);
            }
          }
          renderer.render(scene, camera);
        },
      };
    },
    { alpha: true }
  );
}
