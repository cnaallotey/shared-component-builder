// Lazily starts each WebGL scene when it comes near the viewport.
// Without WebGL, the page keeps its CSS fallbacks.
import { webglAvailable } from './core.js';

const scenes = {
  meadow: () => import('./meadow.js'),
  knob: () => import('./knob.js'),
  flipboard: () => import('./flipboard.js'),
  steps: () => import('./steps.js'),
};

function optionsFor(canvas) {
  const kind = canvas.dataset.scene;
  if (kind === 'meadow') {
    return {
      islands: canvas.dataset.islands !== 'false',
      horizon: Number(canvas.dataset.horizon || 0.56),
      anchor: canvas.dataset.anchor ? document.querySelector(canvas.dataset.anchor) : null,
    };
  }
  if (kind === 'knob') {
    return {
      onToggle: (state) => document.querySelector(`[data-compare-tab="${state}"]`)?.click(),
    };
  }
  if (kind === 'flipboard') {
    const caption = document.getElementById(canvas.dataset.caption || '');
    const code = [
      "builder.define('tally-counter', { template, styles, methods })",
      "const { data } = await builder.export('tally-counter')",
      "await builder.import('/components/tally-counter.json')",
    ];
    return {
      fontUrl: new URL('../../lib/fonts/flip-mono.typeface.json', import.meta.url).href,
      onWord: (word, index) => caption && (caption.textContent = code[index]),
    };
  }
  return {};
}

async function start(canvas) {
  const host = canvas.closest('[data-scene-host]') || canvas.parentElement;
  try {
    const module = await scenes[canvas.dataset.scene]();
    await module.mount(canvas, optionsFor(canvas));
    host.classList.add('scene-ready');
  } catch (error) {
    console.warn(`Scene "${canvas.dataset.scene}" could not start:`, error);
    host.classList.add('scene-failed');
  }
}

if (webglAvailable()) {
  document.documentElement.classList.add('webgl');
  // Labels drawn into textures use the page fonts, so wait for them.
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();
  ready.then(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          start(entry.target);
        });
      },
      { rootMargin: '400px 0px' }
    );
    document.querySelectorAll('canvas[data-scene]').forEach((canvas) => observer.observe(canvas));
  });
}
