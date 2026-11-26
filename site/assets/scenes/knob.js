// A machined metal knob that turns between "Before" and "After".
// The accessible control is the pair of buttons next to it; this scene follows
// the `scb:knob` event and turns the page's toggle when clicked or dragged.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runScene, isNight } from './core.js';

export function mount(canvas, { eventTarget = window, onToggle = () => {} } = {}) {
  return runScene(
    canvas,
    ({ renderer }) => {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 4.6, 3.6);
      camera.lookAt(0, 0, 0);

      const key = new THREE.DirectionalLight('#ffffff', 1.4);
      key.position.set(2, 5, 3);
      scene.add(key);

      // Dark collar with a notch, like an instrument dial
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.32, 1.4, 0.3, 64),
        new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.45, metalness: 0.6 })
      );
      collar.position.y = -0.2;
      scene.add(collar);

      const knob = new THREE.Group();
      scene.add(knob);

      const metal = new THREE.MeshStandardMaterial({ color: '#d7dbe0', metalness: 1, roughness: 0.28 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, 0.5, 96), metal);
      body.position.y = 0.15;
      knob.add(body);

      // Knurled grip: thin ridges around the rim
      const ridgeCount = 60;
      const ridges = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.05, 0.46, 0.06),
        new THREE.MeshStandardMaterial({ color: '#c3c8ce', metalness: 1, roughness: 0.35 }),
        ridgeCount
      );
      const m = new THREE.Matrix4();
      for (let i = 0; i < ridgeCount; i++) {
        const a = (i / ridgeCount) * Math.PI * 2;
        m.makeRotationY(-a).setPosition(Math.cos(a) * 1.03, 0.15, Math.sin(a) * 1.03);
        ridges.setMatrixAt(i, m);
      }
      knob.add(ridges);

      // Brushed, slightly domed cap
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 64, 16, 0, Math.PI * 2, 0, 0.62),
        new THREE.MeshStandardMaterial({ color: '#eceff2', metalness: 1, roughness: 0.18 })
      );
      cap.position.y = 0.4 - 1.6 * Math.cos(0.62);
      knob.add(cap);

      // Centre gem: silver before, glowing emerald after
      const gemMaterial = new THREE.MeshPhysicalMaterial({
        color: '#b9bfc7',
        metalness: 0.4,
        roughness: 0.12,
        clearcoat: 1,
        emissive: new THREE.Color('#10b981'),
        emissiveIntensity: 0,
      });
      // The cap is a sphere slice whose top sits at y ≈ 0.70; keep the gem on top of it.
      const gem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 48), gemMaterial);
      gem.position.y = 0.72;
      knob.add(gem);

      // Pointer notch near the rim
      const pointerMat = new THREE.MeshStandardMaterial({
        color: '#2b2f36',
        emissive: new THREE.Color('#34d399'),
        emissiveIntensity: 0,
        roughness: 0.4,
      });
      const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.34), pointerMat);
      pointer.position.set(0, 0.56, -0.72);
      pointer.rotation.x = -0.45; // follow the dome's slope
      knob.add(pointer);

      // Soft contact shadow
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = shadowCanvas.height = 128;
      const sctx = shadowCanvas.getContext('2d');
      const grad = sctx.createRadialGradient(64, 64, 10, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0,0,0,0.45)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 4.2),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -0.36;
      scene.add(shadow);

      // State
      const ANGLE = 0.85; // radians either side
      let state = 0;
      let angle = -ANGLE;
      let velocity = 0;
      let glow = 0;
      let dragging = null;

      eventTarget.addEventListener('scb:knob', (e) => {
        state = e.detail.state;
      });

      canvas.addEventListener('pointerdown', (e) => {
        dragging = { x: e.clientX, start: angle, moved: false };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - dragging.x;
        if (Math.abs(dx) > 4) dragging.moved = true;
        angle = THREE.MathUtils.clamp(dragging.start + dx * 0.012, -ANGLE * 1.15, ANGLE * 1.15);
      });
      const release = () => {
        if (!dragging) return;
        const next = dragging.moved ? (angle > 0 ? 1 : 0) : 1 - state;
        dragging = null;
        if (next !== state) onToggle(next);
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);

      return {
        resize(width, height) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        },
        frame(time, delta) {
          const target = state ? ANGLE : -ANGLE;
          if (!dragging) {
            if (delta) {
              // Spring towards the target with a little overshoot, like a detent.
              velocity += (target - angle) * 90 * delta;
              velocity *= Math.pow(0.0009, delta);
              angle += velocity * delta;
            } else {
              angle = target;
            }
          }
          knob.rotation.y = -angle;
          glow += ((state ? 1 : 0) - glow) * (delta ? Math.min(1, delta * 5) : 1);
          gemMaterial.color.set('#b9bfc7').lerp(new THREE.Color('#0f9f73'), glow);
          gemMaterial.emissiveIntensity = glow * (0.55 + Math.sin(time * 2.5) * 0.12);
          pointerMat.emissiveIntensity = glow * 1.6;
          collar.material.color.set(isNight() ? '#0f1115' : '#1b1d22');
          renderer.render(scene, camera);
        },
      };
    },
    { alpha: true }
  );
}
