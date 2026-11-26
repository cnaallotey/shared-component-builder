// Hero scene: a shader sky over a wind-swept meadow. Two floating islands are
// "Project A" and "Project B"; a component cube hops from A to B, the same trip
// the live demo makes. At night: stars, moonlit clouds and fireflies.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  runScene,
  isNight,
  isSmallScreen,
  labelTexture,
  glyphTexture,
  ease,
  clamp01,
  GLSL_NOISE,
} from './core.js';

const PALETTE = {
  day: {
    skyTop: '#4f8fe8',
    skyHorizon: '#dcebfb',
    cloud: '#ffffff',
    cloudShade: '#b9c9de',
    grassBase: '#2c5a1c',
    grassTip: '#b4d86a',
    ground: '#2f5520',
    hemiSky: '#cfe4ff',
    hemiGround: '#5e7f34',
    sun: '#fff1d6',
  },
  night: {
    skyTop: '#050a1f',
    skyHorizon: '#1b2648',
    cloud: '#5b6a92',
    cloudShade: '#222b4a',
    grassBase: '#06110a',
    grassTip: '#25432c',
    ground: '#07120a',
    hemiSky: '#2c3a66',
    hemiGround: '#08120a',
    sun: '#9fb6ff',
  },
};

const PROJECT_A = '#2f6bff';
const PROJECT_B = '#ffb224';

export function mount(canvas, { islands = true, horizon = 0.56, anchor = null, eventTarget = window } = {}) {
  return runScene(canvas, ({ renderer }) => {
    renderer.autoClear = false;
    const small = isSmallScreen();

    // ---------- Sky (full-screen quad) ----------
    const skyScene = new THREE.Scene();
    const skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const skyUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uHorizon: { value: 1 - horizon },
      uNight: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uTopDay: { value: new THREE.Color(PALETTE.day.skyTop) },
      uHorizonDay: { value: new THREE.Color(PALETTE.day.skyHorizon) },
      uTopNight: { value: new THREE.Color(PALETTE.night.skyTop) },
      uHorizonNight: { value: new THREE.Color(PALETTE.night.skyHorizon) },
      uCloudDay: { value: new THREE.Color(PALETTE.day.cloud) },
      uCloudShadeDay: { value: new THREE.Color(PALETTE.day.cloudShade) },
      uCloudNight: { value: new THREE.Color(PALETTE.night.cloud) },
      uCloudShadeNight: { value: new THREE.Color(PALETTE.night.cloudShade) },
    };
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uAspect, uHorizon, uNight;
          uniform vec2 uRes;
          uniform vec2 uMouse;
          uniform vec3 uTopDay, uHorizonDay, uTopNight, uHorizonNight;
          uniform vec3 uCloudDay, uCloudShadeDay, uCloudNight, uCloudShadeNight;
          varying vec2 vUv;
          ${GLSL_NOISE}
          void main() {
            float h = clamp((vUv.y - uHorizon) / (1.0 - uHorizon), 0.0, 1.0);
            vec3 top = mix(uTopDay, uTopNight, uNight);
            vec3 hor = mix(uHorizonDay, uHorizonNight, uNight);
            vec3 col = mix(hor, top, pow(h, 0.75));

            // Sun glow by day, moon by night: placed in pixels from the top-right
            // corner so they keep their size on tall or narrow canvases.
            vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
            vec2 orb = vec2(uRes.x - max(70.0, uRes.x * 0.12), 118.0);
            float d = length(px - orb);
            col += (1.0 - uNight) * vec3(1.0, 0.93, 0.78) * 0.32 * exp(-d / 260.0);
            col = mix(col, vec3(0.93, 0.95, 1.0), uNight * smoothstep(23.0, 21.0, d));
            col += uNight * vec3(0.5, 0.6, 1.0) * 0.22 * exp(-d / 70.0);

            // Clouds: two layers of domain-warped fbm drifting with time.
            vec2 p = vec2(vUv.x * uAspect, vUv.y) * vec2(1.6, 3.2) + uMouse * 0.04;
            p.x += uTime * 0.018;
            float warp = fbm(p * 0.7 + vec2(0.0, uTime * 0.01));
            float n = fbm(p + warp * 0.9);
            float band = smoothstep(0.02, 0.35, h) * (1.0 - smoothstep(0.85, 1.0, h) * 0.4);
            float cover = smoothstep(0.44, 0.72, n) * band;
            float shadeN = n * 0.6 + warp * 0.4;
            vec3 cloud = mix(uCloudDay, uCloudNight, uNight);
            vec3 cloudShade = mix(uCloudShadeDay, uCloudShadeNight, uNight);
            vec3 cloudCol = mix(cloud, cloudShade, smoothstep(0.55, 0.85, shadeN) * 0.75);
            col = mix(col, cloudCol, cover * (0.92 - uNight * 0.4));

            // Stars at night, hidden behind clouds.
            vec2 grid = floor(vUv * vec2(uAspect, 1.0) * 260.0);
            float star = step(0.9965, hash(grid));
            float twinkle = 0.55 + 0.45 * sin(uTime * 2.2 + hash(grid + 3.1) * 40.0);
            col += uNight * star * twinkle * smoothstep(0.1, 0.7, h) * (1.0 - cover) * 0.9;

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    skyScene.add(sky);

    // The sky is soft, so it's rendered at low resolution and stretched.
    const skyTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });
    const SKY_SCALE = 0.3;
    const skyBlit = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: skyTarget.texture } },
        depthWrite: false,
        depthTest: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(uMap, vUv);
            #include <colorspace_fragment>
          }
        `,
      })
    );
    const blitScene = new THREE.Scene();
    blitScene.add(skyBlit);

    // ---------- 3D scene ----------
    // The meadow is drawn through its own wide camera into the lower part of
    // the canvas, so grass keeps a natural scale however tall the section is.
    // Islands and the cube live in the "air" scene, drawn over the whole canvas.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 220);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 1.75, 6);

    const air = new THREE.Scene();
    const airCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 220);
    airCamera.rotation.order = 'YXZ';
    airCamera.position.set(0, 1.05, 6);

    const hemi = new THREE.HemisphereLight(PALETTE.day.hemiSky, PALETTE.day.hemiGround, 1.4);
    const sun = new THREE.DirectionalLight(PALETTE.day.sun, 2.4);
    sun.position.set(6, 9, 4);
    const airHemi = hemi.clone();
    const airSun = sun.clone();
    scene.add(hemi, sun);
    air.add(airHemi, airSun);

    const fogUniforms = {
      uFog: { value: new THREE.Color(PALETTE.day.skyHorizon) },
      uFogNear: { value: 6 },
      uFogFar: { value: 46 },
    };

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.ShaderMaterial({
        uniforms: { ...fogUniforms, uColor: { value: new THREE.Color(PALETTE.day.ground) } },
        vertexShader: /* glsl */ `
          varying float vDepth;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor, uFog; uniform float uFogNear, uFogFar;
          varying float vDepth;
          void main() {
            gl_FragColor = vec4(mix(uColor, uFog, smoothstep(uFogNear, uFogFar, vDepth)), 1.0);
            #include <colorspace_fragment>
          }
        `,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Grass: one tapered blade, instanced thousands of times, bent by wind in the shader.
    const windUniforms = { uTime: { value: 0 }, uGust: { value: 0 } };
    const blade = new THREE.PlaneGeometry(0.07, 1, 1, 5);
    blade.translate(0, 0.5, 0);
    {
      const pos = blade.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setX(i, pos.getX(i) * (1 - y * 0.92));
      }
    }

    const fieldDepth = { near: 4.7, far: -48 };
    const spread = (z) => (6 - z) * 0.95 + 1.5;

    function scatter(count, minH, maxH) {
      const offsets = new Float32Array(count * 3);
      const scales = new Float32Array(count);
      const angles = new Float32Array(count);
      const tints = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        // Bias towards the camera so the foreground is dense.
        const t = Math.pow(Math.random(), 1.6);
        const z = fieldDepth.near + (fieldDepth.far - fieldDepth.near) * t;
        const x = (Math.random() * 2 - 1) * spread(z);
        offsets.set([x, 0, z], i * 3);
        scales[i] = minH + Math.random() * (maxH - minH);
        angles[i] = Math.random() * Math.PI;
        tints[i] = Math.random();
      }
      return { offsets, scales, angles, tints };
    }

    const WIND_GLSL = /* glsl */ `
      uniform float uTime, uGust;
      float windAt(vec3 o) {
        float w = sin(uTime * 1.5 + o.x * 0.32 + o.z * 0.21) * 0.55
                + sin(uTime * 0.7 + o.x * 0.09 - o.z * 0.05) * 0.45;
        return 0.22 + 0.18 * w + uGust * 0.35;
      }
    `;

    const grassCount = small ? 10000 : 24000;
    const grassData = scatter(grassCount, 0.3, 0.8);
    const grassGeo = new THREE.InstancedBufferGeometry();
    grassGeo.index = blade.index;
    grassGeo.attributes.position = blade.attributes.position;
    grassGeo.attributes.uv = blade.attributes.uv;
    grassGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(grassData.offsets, 3));
    grassGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(grassData.scales, 1));
    grassGeo.setAttribute('aAngle', new THREE.InstancedBufferAttribute(grassData.angles, 1));
    grassGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(grassData.tints, 1));
    grassGeo.instanceCount = grassCount;

    const grassUniforms = {
      ...windUniforms,
      ...fogUniforms,
      uBase: { value: new THREE.Color(PALETTE.day.grassBase) },
      uTip: { value: new THREE.Color(PALETTE.day.grassTip) },
    };
    const grass = new THREE.Mesh(
      grassGeo,
      new THREE.ShaderMaterial({
        uniforms: grassUniforms,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          attribute vec3 aOffset; attribute float aScale, aAngle, aTint;
          varying float vH, vTint, vDepth;
          ${WIND_GLSL}
          void main() {
            vec3 p = position;
            float h = p.y;
            p.y *= aScale;
            float c = cos(aAngle), s = sin(aAngle);
            p = vec3(p.x * c, p.y, p.x * s);
            float bend = windAt(aOffset) * h * h * aScale;
            p.x += bend; p.z += bend * 0.35; p.y -= bend * bend * 0.5;
            vec4 mv = viewMatrix * modelMatrix * vec4(p + aOffset, 1.0);
            vDepth = -mv.z; vH = h; vTint = aTint;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uBase, uTip, uFog; uniform float uFogNear, uFogFar;
          varying float vH, vTint, vDepth;
          void main() {
            vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vH));
            col *= 0.78 + vTint * 0.4;
            col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDepth));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      })
    );
    grass.frustumCulled = false;
    scene.add(grass);

    // Flowers: little heads on stems, swaying with the same wind.
    const flowerCount = small ? 380 : 1100;
    const flowerData = scatter(flowerCount, 0.4, 0.75);
    const flowerColors = new Float32Array(flowerCount * 3);
    const flowerPalette = ['#ffffff', '#ffe066', '#ff9ec7', '#c7a6ff', '#ffb224'].map((c) => new THREE.Color(c));
    for (let i = 0; i < flowerCount; i++) {
      flowerColors.set(flowerPalette[i % flowerPalette.length].toArray(), i * 3);
    }
    const head = new THREE.IcosahedronGeometry(0.045, 1);
    const flowerGeo = new THREE.InstancedBufferGeometry();
    flowerGeo.index = head.index;
    flowerGeo.attributes.position = head.attributes.position;
    flowerGeo.attributes.normal = head.attributes.normal;
    flowerGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(flowerData.offsets, 3));
    flowerGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(flowerData.scales, 1));
    flowerGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(flowerColors, 3));
    flowerGeo.instanceCount = flowerCount;
    const flowerUniforms = { ...windUniforms, ...fogUniforms, uDim: { value: 1 } };
    const flowers = new THREE.Mesh(
      flowerGeo,
      new THREE.ShaderMaterial({
        uniforms: flowerUniforms,
        vertexShader: /* glsl */ `
          attribute vec3 aOffset, aColor; attribute float aScale;
          varying vec3 vColor; varying float vDepth, vLight;
          ${WIND_GLSL}
          void main() {
            float bend = windAt(aOffset) * aScale;
            vec3 top = aOffset + vec3(bend, aScale - bend * bend * 0.5, bend * 0.35);
            vec4 mv = viewMatrix * modelMatrix * vec4(position + top, 1.0);
            vDepth = -mv.z; vColor = aColor;
            vLight = 0.75 + 0.25 * normal.y;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uFog; uniform float uFogNear, uFogFar, uDim;
          varying vec3 vColor; varying float vDepth, vLight;
          void main() {
            vec3 col = vColor * vLight * uDim;
            col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDepth));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      })
    );
    flowers.frustumCulled = false;
    scene.add(flowers);

    // Fireflies (night only)
    const flyCount = small ? 60 : 150;
    const flyPositions = new Float32Array(flyCount * 3);
    const flySeeds = new Float32Array(flyCount);
    for (let i = 0; i < flyCount; i++) {
      const z = 3.5 - Math.random() * 20;
      flyPositions.set([(Math.random() * 2 - 1) * spread(z) * 0.8, 0.2 + Math.random() * 1.5, z], i * 3);
      flySeeds[i] = Math.random() * 100;
    }
    const flyGeo = new THREE.BufferGeometry();
    flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPositions, 3));
    flyGeo.setAttribute('aSeed', new THREE.BufferAttribute(flySeeds, 1));
    const flyUniforms = { uTime: windUniforms.uTime, uNight: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } };
    const fireflies = new THREE.Points(
      flyGeo,
      new THREE.ShaderMaterial({
        uniforms: flyUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSeed; uniform float uTime, uPixel; varying float vGlow;
          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.4 + aSeed) * 0.6;
            p.y += sin(uTime * 0.7 + aSeed * 1.7) * 0.25;
            p.z += cos(uTime * 0.3 + aSeed * 0.6) * 0.5;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vGlow = 0.5 + 0.5 * sin(uTime * 2.4 + aSeed * 5.0);
            gl_PointSize = (26.0 * uPixel) / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uNight; varying float vGlow;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(1.0, 0.92, 0.45) * a * vGlow * uNight, a * uNight);
          }
        `,
      })
    );
    fireflies.frustumCulled = false;
    scene.add(fireflies);

    // ---------- Floating islands and the component cube ----------
    const islandGroup = new THREE.Group();
    air.add(islandGroup);

    function makeIsland(label, color) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 0.94, 0.2, 48),
        new THREE.MeshStandardMaterial({ color: '#7cc24a', roughness: 0.85 })
      );
      const rockGeo = new THREE.ConeGeometry(0.95, 1.5, 9, 4);
      {
        const pos = rockGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (y < 0.7) {
            pos.setX(i, pos.getX(i) * (0.9 + Math.random() * 0.2));
            pos.setZ(i, pos.getZ(i) * (0.9 + Math.random() * 0.2));
          }
        }
        rockGeo.computeVertexNormals();
      }
      const rock = new THREE.Mesh(
        rockGeo,
        new THREE.MeshStandardMaterial({ color: '#8b6d52', roughness: 1, flatShading: true })
      );
      rock.rotation.x = Math.PI;
      rock.position.y = -0.84;
      const tufts = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const tuft = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.22, 5),
          new THREE.MeshStandardMaterial({ color: i % 3 ? '#5ea83a' : '#9ad65a', roughness: 0.9 })
        );
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        const r = 0.55 + Math.random() * 0.35;
        tuft.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
        tufts.add(tuft);
      }
      const { texture, aspect } = labelTexture(label, { dot: color });
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
      sprite.scale.set(0.42 * aspect, 0.42, 1);
      sprite.position.y = 1.05;
      group.add(top, rock, tufts, sprite);
      group.userData.surface = 0.1;
      return group;
    }

    const islandA = makeIsland('Project A', PROJECT_A);
    const islandB = makeIsland('Project B', PROJECT_B);
    islandGroup.add(islandA, islandB);

    const cubeGeo = new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.12);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      map: glyphTexture({ bg: PROJECT_A }),
      roughness: 0.35,
      metalness: 0.1,
      emissive: new THREE.Color(PROJECT_A),
      emissiveIntensity: 0.12,
    });
    const cubeA = new THREE.Mesh(cubeGeo, cubeMaterial);
    const traveller = new THREE.Mesh(cubeGeo, cubeMaterial.clone());
    traveller.material.transparent = true;
    islandA.add(cubeA);
    islandGroup.add(traveller);
    cubeA.position.y = 0.42;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 48),
      new THREE.MeshBasicMaterial({ color: PROJECT_B, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    islandB.add(ring);

    // Spark trail behind the travelling cube
    const sparkCount = 90;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkLife = new Float32Array(sparkCount);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(sparkLife, 1));
    const sparks = new THREE.Points(
      sparkGeo,
      new THREE.ShaderMaterial({
        uniforms: { uPixel: { value: renderer.getPixelRatio() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aLife; uniform float uPixel; varying float vLife;
          void main() {
            vLife = aLife;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (40.0 * uPixel * aLife) / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vLife;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vLife;
            gl_FragColor = vec4(mix(vec3(1.0, 0.75, 0.3), vec3(0.6, 0.75, 1.0), vLife) * a, a);
          }
        `,
      })
    );
    sparks.frustumCulled = false;
    islandGroup.add(sparks);
    let sparkCursor = 0;

    // Hop timeline (seconds)
    const HOP = { travel: 1.5, settle: 0.45, rest: 3.6, fade: 0.55 };
    const CYCLE = HOP.travel + HOP.settle + HOP.rest + HOP.fade + 0.6;
    let hopClock = reducedMotionStill() ? HOP.travel + HOP.settle + 1 : 0.2;
    function reducedMotionStill() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    eventTarget.addEventListener('scb:transfer', () => {
      hopClock = 0;
    });

    let islandsVisible = false;

    function placeIslands(width, height) {
      if (!islands || !anchor) {
        islandsVisible = false;
        islandGroup.visible = false;
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const free = (anchorRect.left - canvasRect.left) - 24;
      islandsVisible = free > 210 && width > 980;
      islandGroup.visible = islandsVisible;
      if (!islandsVisible) return;
      const centerY = (anchorRect.top + anchorRect.height * 0.62 - canvasRect.top) / height;
      const ndcY = 1 - centerY * 2;
      const ndcX = ((anchorRect.left - canvasRect.left) / 2 / width) * 2 - 1;
      const distance = 13;
      const place = (obj, x) => {
        const v = new THREE.Vector3(x, ndcY, 0.5).unproject(airCamera).sub(airCamera.position).normalize();
        obj.position.copy(airCamera.position).addScaledVector(v, distance);
        obj.userData.base = obj.position.clone();
      };
      airCamera.updateMatrixWorld();
      place(islandA, ndcX);
      place(islandB, -ndcX);
      const scale = THREE.MathUtils.clamp(free / 300, 0.6, 1);
      islandA.scale.setScalar(scale);
      islandB.scale.setScalar(scale);
    }

    // ---------- Interaction ----------
    const pointer = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    window.addEventListener(
      'pointermove',
      (e) => {
        pointerTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true }
    );

    // ---------- Day / night ----------
    let night = isNight() ? 1 : 0;
    let nightTarget = night;
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      nightTarget = isNight() ? 1 : 0;
      if (reducedMotionStill()) night = nightTarget;
    };
    scheme.addEventListener('change', onScheme);
    new MutationObserver(onScheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const mixColor = (key) => new THREE.Color(PALETTE.day[key]).lerp(new THREE.Color(PALETTE.night[key]), night);

    function applyNight() {
      skyUniforms.uNight.value = night;
      flyUniforms.uNight.value = night;
      fogUniforms.uFog.value.copy(mixColor('skyHorizon'));
      grassUniforms.uBase.value.copy(mixColor('grassBase'));
      grassUniforms.uTip.value.copy(mixColor('grassTip'));
      ground.material.uniforms.uColor.value.copy(mixColor('ground'));
      flowerUniforms.uDim.value = 1 - night * 0.72;
      hemi.color.copy(mixColor('hemiSky'));
      hemi.groundColor.copy(mixColor('hemiGround'));
      hemi.intensity = 1.4 - night * 0.9;
      sun.color.copy(mixColor('sun'));
      sun.intensity = 2.4 - night * 1.7;
      airHemi.color.copy(hemi.color);
      airHemi.groundColor.copy(hemi.groundColor);
      airHemi.intensity = hemi.intensity * 1.5;
      airSun.color.copy(sun.color);
      airSun.intensity = sun.intensity * 1.2;
    }
    applyNight();

    let pitch = 0;
    let airPitch = 0;
    let canvasW = 1;
    let canvasH = 1;
    let meadowH = 1;

    return {
      resize(width, height) {
        canvasW = width;
        canvasH = height;
        skyUniforms.uAspect.value = width / height;
        skyUniforms.uRes.value.set(width, height);
        skyUniforms.uHorizon.value = 1 - horizon;
        const pr = renderer.getPixelRatio();
        skyTarget.setSize(Math.max(2, Math.round(width * pr * SKY_SCALE)), Math.max(2, Math.round(height * pr * SKY_SCALE)));
        const hfov = THREE.MathUtils.degToRad(small ? 74 : 62);
        const fovFor = (aspect, cap) =>
          Math.min(2 * Math.atan(Math.tan(hfov / 2) / aspect), THREE.MathUtils.degToRad(cap));

        // Meadow viewport: from the bottom edge to a little above the horizon.
        const headroom = Math.min(height * 0.12, 160);
        meadowH = Math.max(1, Math.round(height * (1 - horizon) + headroom));
        const mAspect = width / meadowH;
        const mFov = fovFor(mAspect, 70);
        camera.fov = THREE.MathUtils.radToDeg(mFov);
        camera.aspect = mAspect;
        camera.updateProjectionMatrix();
        // Put the horizon `headroom` pixels below the top of the viewport.
        const fromTop = headroom / meadowH;
        pitch = Math.atan((fromTop - 0.5) * 2 * Math.tan(mFov / 2));
        camera.rotation.set(pitch, 0, 0);

        // Air camera over the whole canvas, horizon at the same height.
        const aAspect = width / height;
        const aFov = fovFor(aAspect, 78);
        airCamera.fov = THREE.MathUtils.radToDeg(aFov);
        airCamera.aspect = aAspect;
        airCamera.updateProjectionMatrix();
        airPitch = Math.atan((horizon - 0.5) * 2 * Math.tan(aFov / 2));
        airCamera.rotation.set(airPitch, 0, 0);
        placeIslands(width, height);
      },

      frame(time, delta) {
        if (night !== nightTarget) {
          night += Math.sign(nightTarget - night) * Math.min(Math.abs(nightTarget - night), delta * 1.5 || 1);
          applyNight();
        }

        pointer.lerp(pointerTarget, delta ? 1 - Math.pow(0.002, delta) : 1);
        camera.rotation.y = -pointer.x * 0.035;
        camera.rotation.x = pitch - pointer.y * 0.012;
        camera.position.x = pointer.x * 0.25;
        airCamera.rotation.y = -pointer.x * 0.02;
        airCamera.rotation.x = airPitch - pointer.y * 0.01;

        windUniforms.uTime.value = time;
        windUniforms.uGust.value = Math.max(0, Math.sin(time * 0.23)) * 0.6;
        skyUniforms.uTime.value = time;
        skyUniforms.uMouse.value.copy(pointer);

        if (islandsVisible) {
          for (const [island, phase] of [[islandA, 0], [islandB, 1.7]]) {
            const base = island.userData.base;
            if (base) island.position.set(base.x, base.y + Math.sin(time * 0.9 + phase) * 0.08, base.z);
            // Tilt the top towards the viewer so the grass, not the rock, faces us.
            island.rotation.set(0.72, Math.sin(time * 0.3 + phase) * 0.12, 0);
          }
          cubeA.rotation.y = time * 0.5;

          hopClock += delta;
          if (hopClock > CYCLE) hopClock = 0;
          const t = hopClock;

          // Cube resting height in island space; matrixWorld already includes the island's scale.
          const from = new THREE.Vector3(0, 0.42, 0).applyMatrix4(islandA.matrixWorld);
          const to = new THREE.Vector3(0, 0.42, 0).applyMatrix4(islandB.matrixWorld);
          const mid = from.clone().lerp(to, 0.5);
          mid.y += 1.5;
          const s = islandA.scale.x;
          const mat = traveller.material;
          ring.material.opacity = 0;

          if (t < HOP.travel) {
            const k = ease.inOutCubic(t / HOP.travel);
            const a = from.clone().lerp(mid, k);
            const b = mid.clone().lerp(to, k);
            traveller.position.copy(a.lerp(b, k));
            traveller.rotation.set(k * Math.PI * 1.5, k * Math.PI * 2, 0);
            traveller.scale.setScalar(s * (0.7 + 0.3 * Math.sin(Math.min(1, t / 0.25) * Math.PI / 2)));
            mat.opacity = Math.min(1, t / 0.2);
            if (delta) {
              for (let i = 0; i < 2; i++) {
                const idx = sparkCursor++ % sparkCount;
                sparkPositions.set(
                  [
                    traveller.position.x + (Math.random() - 0.5) * 0.25,
                    traveller.position.y + (Math.random() - 0.5) * 0.25,
                    traveller.position.z + (Math.random() - 0.5) * 0.25,
                  ],
                  idx * 3
                );
                sparkLife[idx] = 1;
              }
            }
          } else if (t < HOP.travel + HOP.settle + HOP.rest) {
            const k = clamp01((t - HOP.travel) / HOP.settle);
            traveller.position.copy(to);
            traveller.position.y += Math.sin(k * Math.PI) * 0.12 * s;
            traveller.rotation.set(0, time * 0.5, 0);
            const squash = 1 + Math.sin(k * Math.PI) * 0.12;
            traveller.scale.set(s * squash, s / squash, s * squash);
            mat.opacity = 1;
            const ringK = clamp01((t - HOP.travel) / 0.9);
            ring.material.opacity = (1 - ringK) * 0.9;
            ring.scale.setScalar(1 + ringK * 1.6);
          } else {
            const k = clamp01((t - HOP.travel - HOP.settle - HOP.rest) / HOP.fade);
            traveller.position.copy(to);
            traveller.rotation.set(0, time * 0.5, 0);
            traveller.scale.setScalar(s * (1 - ease.outCubic(k)) + 0.0001);
            mat.opacity = 1 - k;
          }

          for (let i = 0; i < sparkCount; i++) {
            if (sparkLife[i] > 0) {
              sparkLife[i] = Math.max(0, sparkLife[i] - delta * 1.4);
              sparkPositions[i * 3 + 1] += delta * 0.15;
            }
          }
          sparkGeo.attributes.position.needsUpdate = true;
          sparkGeo.attributes.aLife.needsUpdate = true;
        }

        renderer.setRenderTarget(skyTarget);
        renderer.render(skyScene, skyCamera);
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.setViewport(0, 0, canvasW, canvasH);
        renderer.render(blitScene, skyCamera);
        renderer.setViewport(0, 0, canvasW, meadowH);
        renderer.render(scene, camera);
        if (islandsVisible) {
          renderer.clearDepth();
          renderer.setViewport(0, 0, canvasW, canvasH);
          renderer.render(air, airCamera);
        }
      },
    };
  });
}
