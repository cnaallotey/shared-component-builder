// Copy buttons, heading anchors and the docs "on this page" highlight.
(function () {
  'use strict';

  function copyText(text, button) {
    const done = () => {
      const label = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = label), 1400);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    } else {
      fallback(text, done);
    }
  }

  function fallback(text, done) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } finally {
      area.remove();
    }
  }

  // Install commands: <div class="install"><code>…</code><button class="copy-button">
  document.querySelectorAll('.install').forEach((box) => {
    const button = box.querySelector('.copy-button');
    const code = box.querySelector('code');
    if (button && code) button.addEventListener('click', () => copyText(code.textContent, button));
  });

  // Code blocks
  document.querySelectorAll('pre:not([data-no-copy])').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code');
    button.addEventListener('click', () => copyText(code.textContent, button));
    pre.appendChild(button);
  });

  // Tabs: click or use arrow keys to switch panels. Each list fires a
  // `tabchange` event so the 3D scenes can follow along.
  document.querySelectorAll('[data-tabs]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab, focus, fromUser = true) => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
      });
      if (focus) tab.focus();
      list.dispatchEvent(new CustomEvent('tabchange', { detail: { index: tabs.indexOf(tab), fromUser } }));
    };
    list.selectTab = (index) => select(tabs[index], false, false);
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (event.key === 'Home') select(tabs[0], true);
        else if (event.key === 'End') select(tabs[tabs.length - 1], true);
        else if (step) select(tabs[(index + step + tabs.length) % tabs.length], true);
        else return;
        event.preventDefault();
      });
    });
  });

  // Before / after: recolour the card and turn the knob.
  const compare = document.querySelector('[data-compare]');
  if (compare) {
    const card = document.querySelector('.compare-card');
    compare.addEventListener('tabchange', (event) => {
      const state = event.detail.index;
      card.dataset.state = state ? 'after' : 'before';
      window.dispatchEvent(new CustomEvent('scb:knob', { detail: { state } }));
    });
  }

  // How it works: step tabs drive the 3D scene and advance on their own
  // while visible, until someone picks a step.
  const steps = document.querySelector('[data-steps]');
  if (steps) {
    let index = 0;
    let userPicked = false;
    let visible = false;
    steps.addEventListener('tabchange', (event) => {
      index = event.detail.index;
      if (event.detail.fromUser) userPicked = true;
      window.dispatchEvent(new CustomEvent('scb:step', { detail: { index } }));
    });
    new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.4 }).observe(steps.parentElement);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    setInterval(() => {
      if (visible && !userPicked && !still.matches && !document.hidden) steps.selectTab((index + 1) % 3);
    }, 4200);
  }

  // Heading anchors in docs
  document.querySelectorAll('.prose h2[id], .prose h3[id]').forEach((heading) => {
    const link = document.createElement('a');
    link.className = 'anchor';
    link.href = `#${heading.id}`;
    while (heading.firstChild) link.appendChild(heading.firstChild);
    heading.appendChild(link);
  });

  // Docs navigation: collapsed on small screens, highlights the current section.
  const nav = document.querySelector('.docs-nav');
  if (nav) {
    if (window.matchMedia('(max-width: 900px)').matches) nav.removeAttribute('open');

    const links = new Map();
    nav.querySelectorAll('a[href^="#"]').forEach((a) => links.set(a.getAttribute('href').slice(1), a));
    const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      const visible = new Set();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
          const current = sections.find((s) => visible.has(s));
          if (!current) return;
          links.forEach((a) => a.classList.remove('is-current'));
          links.get(current.id).classList.add('is-current');
        },
        { rootMargin: '-80px 0px -65% 0px' }
      );
      sections.forEach((s) => observer.observe(s));
    }
  }
})();
