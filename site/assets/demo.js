// Live demo: define a component in "Project A", send only its exported JSON to
// "Project B", and import it there. Each project is a separate sandboxed
// iframe with its own custom element registry, recreated on every run.
(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const editor = $('#demo-code');
  if (!editor) return;

  const markup = $('#demo-markup');
  const runButton = $('#demo-run');
  const resetButton = $('#demo-reset');
  const stageA = $('#stage-a');
  const stageB = $('#stage-b');
  const statusA = $('#status-a');
  const statusB = $('#status-b');
  const parcel = $('#parcel');
  const payload = $('#payload');
  const payloadCode = $('#payload-code');

  // The library is fetched once and inlined into each sandboxed frame, so the
  // frames (which have an opaque origin) never need network access.
  const LIB_URL = new URL('lib/component-builder.umd.js', document.baseURI).href;
  const libSource = fetch(LIB_URL).then((response) => {
    if (!response.ok) throw new Error(`The demo library didn't load (${response.status}). Run npm run site:build.`);
    return response.text();
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let runId = 0;
  let frameA = null;
  let frameB = null;
  let exported = null;

  // Runs inside each iframe. Must be self-contained: it is inlined as source.
  function frameMain() {
    var mount = document.getElementById('mount');
    var currentId = 0;

    function send(message) {
      message.id = currentId;
      parent.postMessage(message, '*');
    }

    window.addEventListener('error', function (event) {
      send({ kind: 'error', message: event.message.replace(/^Uncaught /, '') });
    });

    if (typeof ComponentBuilder === 'undefined') {
      parent.postMessage({ kind: 'error', id: -1, message: 'The library failed to start.' }, '*');
      return;
    }

    var builder = new ComponentBuilder();

    window.addEventListener('message', function (event) {
      if (event.source !== parent) return;
      var msg = event.data || {};
      currentId = msg.id;
      Promise.resolve()
        .then(function () {
          if (msg.kind === 'define') {
            new Function('builder', msg.code)(builder);
            var name = Array.from(builder.registry.keys()).pop();
            if (!name) throw new Error('Call builder.define(...) to define a component.');
            return builder.export(name).then(function (json) {
              mount.innerHTML = msg.markup;
              send({ kind: 'exported', data: json.data });
            });
          }
          if (msg.kind === 'import') {
            return builder.import(msg.data).then(function (name) {
              mount.innerHTML = msg.markup;
              send({ kind: 'imported', name: name });
            });
          }
        })
        .catch(function (error) {
          send({ kind: 'error', message: error.message });
        });
    });

    parent.postMessage({ kind: 'ready' }, '*');
  }

  function isDark() {
    const theme = document.documentElement.dataset.theme;
    if (theme) return theme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function frameDocument(library) {
    // Keep the inlined library from closing its own <script> element.
    const inlined = library.replace(/<\/script/gi, '<\\/script');
    const color = isDark() ? '#eef1f6' : '#16181d';
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; }
  body { display: grid; place-items: center; min-height: 100vh; padding: 16px; box-sizing: border-box;
         font: 15px system-ui, sans-serif; color: ${color}; }
</style>
<script>${inlined}<\/script>
</head><body><div id="mount"></div>
<script>(${frameMain.toString()})();<\/script>
</body></html>`;
  }

  function createFrame(stage, title, library) {
    stage.textContent = '';
    const frame = document.createElement('iframe');
    frame.title = title;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = frameDocument(library);
    stage.appendChild(frame);
    return frame;
  }

  function setStatus(element, text, state) {
    element.textContent = text;
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  }

  function formatSize(bytes) {
    return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} kB`;
  }

  function sendParcel(name, onArrive) {
    parcel.textContent = `${name}.json`;
    if (reducedMotion.matches) {
      onArrive();
      return;
    }
    parcel.classList.remove('is-moving');
    // Restart the animation if a previous run is still in flight.
    void parcel.offsetWidth;
    parcel.classList.add('is-moving');
    // animationend doesn't fire if animations are paused (e.g. a background
    // tab), so a timer guarantees the hand-off.
    let arrived = false;
    const arrive = () => {
      if (arrived) return;
      arrived = true;
      parcel.classList.remove('is-moving');
      onArrive();
    };
    parcel.addEventListener('animationend', arrive, { once: true });
    setTimeout(arrive, 1100);
  }

  function run() {
    runId += 1;
    exported = null;
    frameB = null;
    stageB.textContent = '';
    payload.hidden = true;
    setStatus(statusA, 'Defining the component…');
    setStatus(statusB, 'Waiting for JSON from Project A.');
    const thisRun = runId;
    libSource.then(
      (library) => {
        if (thisRun === runId) frameA = createFrame(stageA, 'Project A preview', library);
      },
      (error) => setStatus(statusA, error.message, 'error')
    );
  }

  window.addEventListener('message', (event) => {
    const fromA = frameA && event.source === frameA.contentWindow;
    const fromB = frameB && event.source === frameB.contentWindow;
    if (!fromA && !fromB) return;
    const msg = event.data || {};
    const status = fromA ? statusA : statusB;

    if (msg.kind === 'ready') {
      if (fromA) {
        frameA.contentWindow.postMessage(
          { kind: 'define', id: runId, code: editor.value, markup: markup.value },
          '*'
        );
      } else {
        frameB.contentWindow.postMessage(
          { kind: 'import', id: runId, data: exported, markup: markup.value },
          '*'
        );
      }
      return;
    }

    if (msg.id !== runId && msg.id !== -1) return;

    if (msg.kind === 'error') {
      setStatus(status, msg.message, 'error');
      return;
    }

    if (msg.kind === 'exported') {
      exported = msg.data;
      const size = new Blob([JSON.stringify(exported)]).size;
      setStatus(statusA, `Defined <${exported.name}> and exported ${formatSize(size)} of JSON.`);
      payloadCode.textContent = JSON.stringify(exported, null, 2);
      payload.hidden = false;
      const thisRun = runId;
      // Let the hero scene send its cube from Project A to Project B too.
      window.dispatchEvent(new CustomEvent('scb:transfer'));
      sendParcel(exported.name, () => {
        if (thisRun !== runId) return;
        setStatus(statusB, 'Importing…');
        libSource.then((library) => {
          if (thisRun === runId) frameB = createFrame(stageB, 'Project B', library);
        });
      });
      return;
    }

    if (msg.kind === 'imported') {
      setStatus(statusB, `Imported <${msg.name}>. This page only received the JSON, not your source code.`);
    }
  });

  runButton.addEventListener('click', run);
  resetButton.addEventListener('click', () => {
    editor.value = editor.defaultValue;
    markup.value = markup.defaultValue;
    run();
  });
  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      run();
    }
  });

  run();
})();
