// Shared helpers for the site's WebGL scenes.
import * as THREE from 'three';

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function isNight() {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function isSmallScreen() {
  return window.matchMedia('(max-width: 760px)').matches;
}

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Run a scene on a canvas. `setup` receives { renderer, canvas } and returns
 * { resize(width, height), frame(time, delta) }. The loop only runs while the
 * canvas is on screen and the tab is visible; with reduced motion a single
 * still frame is drawn instead.
 */
export function runScene(canvas, setup, { alpha = false, antialias = true, startTime = 6 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias,
    powerPreference: 'high-performance',
  });
  const maxRatio = Math.min(window.devicePixelRatio || 1, isSmallScreen() ? 1.5 : 1.75);
  let ratio = maxRatio;
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = setup({ renderer, canvas });

  let width = 0;
  let height = 0;
  let visible = false;
  let running = false;
  let frameId = 0;
  let last = 0;
  let time = startTime;

  const draw = (delta) => scene.frame(time, delta);

  // Adaptive resolution: if frames are slow, render fewer pixels; if there's
  // headroom, render more (up to the device's ratio).
  let sampleTime = 0;
  let sampleFrames = 0;
  const adapt = (rawDelta) => {
    sampleTime += rawDelta;
    sampleFrames += 1;
    if (sampleTime < 1.2) return;
    const fps = sampleFrames / sampleTime;
    sampleTime = 0;
    sampleFrames = 0;
    let next = ratio;
    if (fps < 45) next = Math.max(0.5, ratio * 0.8);
    else if (fps > 58) next = Math.min(maxRatio, ratio * 1.1);
    if (Math.abs(next - ratio) > 0.02) {
      ratio = next;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      scene.resize(width, height);
    }
  };

  const loop = (now) => {
    const rawDelta = (now - last) / 1000;
    const delta = Math.min(0.05, rawDelta);
    last = now;
    time += delta;
    draw(delta);
    adapt(rawDelta);
    frameId = requestAnimationFrame(loop);
  };

  const update = () => {
    const shouldRun = visible && !document.hidden && !reducedMotion.matches;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      frameId = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(frameId);
    }
    if (!running && visible) draw(0);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    scene.resize(w, h);
    if (!running) draw(0);
  };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      update();
    },
    { rootMargin: '120px' }
  ).observe(canvas);
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
  resize();

  return {
    renderer,
    redraw: () => draw(0),
    isRunning: () => running,
  };
}

/** A rounded "pill" label drawn on a 2D canvas, for sprites and textures. */
export function labelTexture(text, { fg = '#16181d', bg = 'rgba(255,255,255,0.92)', dot = null, size = 64 } = {}) {
  const font = `600 ${size}px "Bricolage Grotesque", system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const padX = size * 0.6;
  const dotSpace = dot ? size * 0.75 : 0;
  const w = Math.ceil(measure.measureText(text).width + padX * 2 + dotSpace);
  const h = Math.ceil(size * 1.7);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();
  if (dot) {
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(padX + size * 0.22, h / 2, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX + dotSpace, h / 2 + size * 0.04);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: w / h };
}

/** The "</>" face used on component cubes. */
export function glyphTexture({ bg = '#2f6bff', fg = '#ffffff', size = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, shade(bg, -0.28));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = fg;
  ctx.lineWidth = size * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = size;
  ctx.beginPath();
  ctx.moveTo(s * 0.36, s * 0.33);
  ctx.lineTo(s * 0.2, s * 0.5);
  ctx.lineTo(s * 0.36, s * 0.67);
  ctx.moveTo(s * 0.64, s * 0.33);
  ctx.lineTo(s * 0.8, s * 0.5);
  ctx.lineTo(s * 0.64, s * 0.67);
  ctx.moveTo(s * 0.55, s * 0.28);
  ctx.lineTo(s * 0.45, s * 0.72);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour. */
export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  const target = amount > 0 ? new THREE.Color('#ffffff') : new THREE.Color('#000000');
  c.lerp(target, Math.abs(amount));
  return `#${c.getHexString()}`;
}

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** GLSL noise shared by shaders. */
export const GLSL_NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
`;
