// Live components on the landing page, built with the library itself.
(function () {
  'use strict';
  if (!window.ComponentBuilder || !window.customElements) return;

  const builder = new window.ComponentBuilder();

  builder.define('sb-gauge', {
    props: ['value', 'label'],
    template: (props, state, { escape }) => {
      const value = Math.max(0, Math.min(100, Number(props.value) || 0));
      const circumference = 2 * Math.PI * 42;
      const filled = ((circumference * value) / 100).toFixed(1);
      return `
        <figure>
          <svg viewBox="0 0 100 100" role="img" aria-label="${escape(props.label)}: ${value}%">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#6b95ff"/><stop offset="1" stop-color="#2f6bff"/>
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="42" class="track"/>
            <circle cx="50" cy="50" r="42" class="bar" stroke-dasharray="${filled} ${circumference.toFixed(1)}"/>
          </svg>
          <figcaption><strong>${value}%</strong><span>${escape(props.label)}</span></figcaption>
        </figure>`;
    },
    styles: `
      :host { display: block; }
      figure { display: flex; align-items: center; gap: 18px; margin: 0; }
      svg { width: 96px; height: 96px; transform: rotate(-90deg); flex: none; }
      circle { fill: none; stroke-width: 11; }
      .track { stroke: rgba(22, 24, 29, 0.08); }
      .bar { stroke: url(#g); stroke-linecap: round; transition: stroke-dasharray 160ms ease-out; }
      strong { display: block; font: 600 34px/1 "Bricolage Grotesque", system-ui, sans-serif; letter-spacing: -0.03em; color: #16181d; }
      span { color: #3a4250; font: 500 14px "Geist", system-ui, sans-serif; }
    `,
  });

  builder.define('sb-notify-button', {
    props: ['label'],
    initialState: { sent: 0 },
    template: (props, state, { escape }) => `
      <button on-click="send">${escape(props.label || 'Emit an event')}<span>${state.sent}</span></button>
    `,
    styles: `
      button {
        display: inline-flex; align-items: center; gap: 10px;
        min-height: 44px; padding: 0 8px 0 18px; border: 0; border-radius: 999px;
        background: #16181d; color: #fff; font: 600 14px "Geist", system-ui, sans-serif; cursor: pointer;
      }
      button:hover { background: #2a2d35; }
      button:focus-visible { outline: 3px solid #2f6bff; outline-offset: 2px; }
      span {
        display: grid; place-items: center; min-width: 28px; height: 28px; padding: 0 6px;
        border-radius: 999px; background: #ffb224; color: #16181d; font-variant-numeric: tabular-nums;
      }
    `,
    methods: {
      send() {
        this.setState({ sent: this.state.sent + 1 });
        this.emit('sb-notify', { count: this.state.sent });
      },
    },
  });

  // The slider changes the gauge's attribute; the element re-renders itself.
  const gauge = document.getElementById('live-gauge');
  const input = document.getElementById('live-gauge-input');
  const valueText = document.getElementById('live-gauge-value');
  if (gauge && input) {
    input.addEventListener('input', () => {
      gauge.setAttribute('value', input.value);
      valueText.textContent = input.value;
    });
  }

  // Events emitted by the button bubble out to the page.
  const stack = document.getElementById('toast-stack');
  if (stack) {
    document.addEventListener('sb-notify', (event) => {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = '<span class="toast-icon">!</span><div></div>';
      const text = toast.querySelector('div');
      text.textContent = `sb-notify received`;
      const small = document.createElement('small');
      small.textContent = `detail.count = ${event.detail.count}`;
      text.appendChild(small);
      stack.prepend(toast);
      while (stack.children.length > 3) stack.lastElementChild.remove();
    });
  }
})();
