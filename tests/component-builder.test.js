import ComponentBuilder from '../src/component-builder.js';

// jsdom's custom element registry is shared by every test in this file and
// elements can't be redefined, so each test uses fresh names.
let counter = 0;
const uid = (base = 'test') => `${base}-${++counter}`;

const okResponse = (body) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

function mount(name, attrs = {}) {
  const el = document.createElement(name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  document.body.appendChild(el);
  return el;
}

// Shadow DOM markup without the <style> block.
const html = (el) => el.shadowRoot.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '');

function runScript(script) {
  new Function(script)();
}

async function roundTrip(definition, attrs) {
  const source = new ComponentBuilder();
  source.define(uid('src'), definition);
  const name = [...source.registry.keys()][0];
  const json = await source.export(name);
  const target = new ComponentBuilder();
  const importedName = await target.import(JSON.parse(JSON.stringify(json.data)), {
    name: uid('imported'),
  });
  return { el: mount(importedName, attrs), json, target, importedName };
}

describe('ComponentBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new ComponentBuilder();
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    test('creates instance with default options', () => {
      expect(builder.registry).toBeInstanceOf(Map);
      expect(builder.config.apiEndpoint).toBe(null);
    });

    test('keeps custom options', () => {
      const custom = new ComponentBuilder({ apiEndpoint: 'https://api.example.com', foo: 1 });
      expect(custom.config.apiEndpoint).toBe('https://api.example.com');
      expect(custom.config.foo).toBe(1);
    });
  });

  describe('define', () => {
    test('returns fully serializable component data', () => {
      const name = uid();
      const result = builder.define(name, {
        version: '2.0.0',
        props: ['title', 'content'],
        template: (props) => `<div>${props.title}: ${props.content}</div>`,
        styles: 'div { color: blue; }',
        methods: { greet(who) { return `hi ${who}`; } },
        initialState: { n: 1 },
        mounted() {},
        description: 'metadata is kept',
        helper: () => 'functions in metadata are dropped',
      });

      expect(result.name).toBe(name);
      expect(result.version).toBe('2.0.0');
      expect(result.props).toEqual(['title', 'content']);
      expect(typeof result.template).toBe('string');
      expect(typeof result.methods.greet).toBe('string');
      expect(typeof result.mounted).toBe('string');
      expect(result.description).toBe('metadata is kept');
      expect(result).not.toHaveProperty('helper');
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(builder.registry.get(name)).toBe(result);
    });

    test('uses default values when not provided', () => {
      const result = builder.define(uid(), { template: () => '<div>test</div>' });

      expect(result.version).toBe('1.0.0');
      expect(result.props).toEqual([]);
      expect(result.styles).toBe('');
      expect(result.methods).toEqual({});
      expect(result.events).toEqual([]);
      expect(result.initialState).toEqual({});
      expect(result.mounted).toBe(null);
    });

    test('metadata cannot overwrite core fields', () => {
      const name = uid();
      const result = builder.define(name, { template: () => '', created: 0 });
      expect(result.name).toBe(name);
      expect(result.created).not.toBe(0);
    });

    test.each(['nohyphen', 'Has-Upper', '1-starts-with-digit', 'font-face', '', null])(
      'rejects invalid name %p',
      (name) => {
        expect(() => builder.define(name, { template: () => '' })).toThrow(/Invalid component name/);
      }
    );

    test('requires a template function', () => {
      expect(() => builder.define(uid(), {})).toThrow(/template function/);
    });

    test('throws on redefinition and keeps the original', () => {
      const name = uid();
      builder.define(name, { template: () => 'v1' });
      expect(() => builder.define(name, { template: () => 'v2' })).toThrow(/already defined/);
      expect(() => new ComponentBuilder().define(name, { template: () => 'v2' })).toThrow(
        /already defined/
      );
      expect(html(mount(name))).toBe('v1');
    });

    test('renders props and styles, and re-renders on attribute change', () => {
      const name = uid();
      builder.define(name, {
        props: ['title'],
        template: (props) => `<b>${props.title}</b>`,
        styles: 'b { color: red; }',
      });
      const el = mount(name, { title: 'Hello' });

      expect(el.shadowRoot.innerHTML).toBe('<style>b { color: red; }</style><b>Hello</b>');
      el.setAttribute('title', 'Changed');
      expect(html(el)).toBe('<b>Changed</b>');
      el.removeAttribute('title');
      expect(html(el)).toBe('<b></b>');
    });

    test('renders once when connected, not once per initial attribute', () => {
      const name = uid();
      const template = jest.fn(() => '');
      builder.define(name, { props: ['a', 'b', 'c'], template });
      mount(name, { a: '1', b: '2', c: '3' });
      expect(template).toHaveBeenCalledTimes(1);
    });

    test('gives each instance its own state', () => {
      const name = uid();
      builder.define(name, { template: () => '', initialState: { n: 0, nested: { x: 1 } } });
      const a = mount(name);
      const b = mount(name);
      a.state.n = 99;
      a.state.nested.x = 99;
      expect(b.state).toEqual({ n: 0, nested: { x: 1 } });
    });

    test('mounted runs after first render and setState re-renders', () => {
      const name = uid();
      builder.define(name, {
        props: ['initial'],
        template: (props, state) => `${state.count}`,
        initialState: { count: 0 },
        mounted() {
          expect(this.shadowRoot.innerHTML).toBe('0');
          this.setState({ count: parseInt(this.props.initial, 10) });
        },
      });
      expect(html(mount(name, { initial: '5' }))).toBe('5');
    });

    test('on-<event> attributes call methods with the event and element', () => {
      const name = uid();
      const seen = [];
      builder.define(name, {
        template: (props, state) => `
          <span>${state.count}</span>
          <button on-click="increment" data-step="2"><i>+</i></button>
          <input on-input="typed">`,
        initialState: { count: 0 },
        methods: {
          increment(event, element) {
            this.setState({ count: this.state.count + Number(element.dataset.step) });
          },
          typed(event) {
            seen.push(event.target.value);
          },
        },
      });
      const el = mount(name);

      // Click on a child of the annotated element.
      el.shadowRoot.querySelector('i').click();
      el.shadowRoot.querySelector('button').click();
      expect(el.shadowRoot.querySelector('span').textContent).toBe('4');

      const input = el.shadowRoot.querySelector('input');
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(seen).toEqual(['abc']);
    });

    test('warns when an on-<event> method does not exist', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const name = uid();
      builder.define(name, { template: () => '<button on-click="missing"></button>' });
      mount(name).shadowRoot.querySelector('button').click();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('no method "missing"'));
      warn.mockRestore();
    });

    test('emit dispatches a bubbling, composed event', () => {
      const name = uid();
      builder.define(name, {
        template: () => '<button on-click="close"></button>',
        methods: {
          close() {
            this.emit('my-close', { why: 'test' });
          },
        },
      });
      const listener = jest.fn();
      document.addEventListener('my-close', listener);
      mount(name).shadowRoot.querySelector('button').click();
      document.removeEventListener('my-close', listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail).toEqual({ why: 'test' });
    });

    test('passes an escape helper to templates', () => {
      const name = uid();
      builder.define(name, {
        props: ['msg'],
        template: (props, state, { escape }) => `<p>${escape(props.msg)}</p>`,
      });
      const el = mount(name, { msg: '<img src=x onerror=alert(1)>' });
      expect(el.shadowRoot.querySelector('img')).toBe(null);
      expect(el.shadowRoot.querySelector('p').textContent).toBe('<img src=x onerror=alert(1)>');
    });
  });

  describe('export', () => {
    let name;

    beforeEach(() => {
      name = uid();
      builder.define(name, {
        props: ['title'],
        template: (props) => `<div>${props.title}</div>`,
        styles: 'div { color: red; }',
      });
    });

    test('exports as JSON by default', async () => {
      const result = await builder.export(name);

      expect(result.type).toBe('json');
      expect(result.data.name).toBe(name);
      expect(result.data.props).toEqual(['title']);
      expect(result.usage).toContain('Usage Instructions');
    });

    test('exports as script', async () => {
      const result = await builder.export(name, { type: 'script' });

      expect(typeof result).toBe('string');
      expect(result).toContain(name);
      expect(result).toContain('customElements.define');
    });

    test('throws for non-existent component', async () => {
      await expect(builder.export('non-existent')).rejects.toThrow(
        'Component non-existent not found'
      );
    });

    test('posts to cloud when configured', async () => {
      const cloud = new ComponentBuilder({ apiEndpoint: 'https://api.example.com/' });
      const cloudName = uid();
      cloud.define(cloudName, { template: () => '' });
      fetch.mockResolvedValueOnce(okResponse({ success: true }));

      const result = await cloud.export(cloudName, { type: 'cloud' });

      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/components',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(JSON.parse(fetch.mock.calls[0][1].body).name).toBe(cloudName);
    });

    test('rejects when the cloud responds with an error status', async () => {
      const cloud = new ComponentBuilder({ apiEndpoint: 'https://api.example.com' });
      const cloudName = uid();
      cloud.define(cloudName, { template: () => '' });
      fetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });

      await expect(cloud.export(cloudName, { type: 'cloud' })).rejects.toThrow(
        /failed with status 500 Server Error/
      );
    });
  });

  describe('export → import round trip', () => {
    test('renders the same markup after import', async () => {
      const { el } = await roundTrip(
        {
          props: ['title'],
          template: (props) => `<b>${props.title}</b>`,
          styles: 'b { color: red; }',
        },
        { title: 'Hi' }
      );
      expect(el.shadowRoot.innerHTML).toBe('<style>b { color: red; }</style><b>Hi</b>');
    });

    test.each([
      ['arrow with custom param names', { template: (p, s) => `<i>${p.t}${s.x}</i>` }],
      [
        'function expression',
        {
          template: function (props, state) {
            return `<i>${props.t}${state.x}</i>`;
          },
        },
      ],
      [
        'method shorthand',
        {
          template(props, state) {
            return `<i>${props.t}${state.x}</i>`;
          },
        },
      ],
    ])('supports %s templates', async (label, { template }) => {
      const { el } = await roundTrip(
        { props: ['t'], template, initialState: { x: '!' } },
        { t: 'ok' }
      );
      expect(html(el)).toBe('<i>ok!</i>');
    });

    test('keeps methods (with parameters), state, mounted and event wiring', async () => {
      const { el } = await roundTrip({
        props: ['step'],
        template: (props, state) =>
          `<span>${state.count}</span><button on-click="increment"></button>`,
        initialState: { count: 0 },
        methods: {
          add(amount) {
            this.setState({ count: this.state.count + amount });
          },
          increment() {
            this.add(Number(this.props.step || 1));
          },
          async later(value) {
            return value;
          },
        },
        mounted() {
          this.setState({ count: 10 });
        },
      }, { step: '3' });

      expect(el.shadowRoot.querySelector('span').textContent).toBe('10');
      el.shadowRoot.querySelector('button').click();
      expect(el.shadowRoot.querySelector('span').textContent).toBe('13');
      await expect(el.later(7)).resolves.toBe(7);
    });

    test('an imported component can be exported again', async () => {
      const { target, importedName } = await roundTrip({
        props: ['a'],
        template: (props) => props.a,
      });
      const again = await target.export(importedName);
      expect(again.data.name).toBe(importedName);
      // Metadata from the previous export isn't kept in the registry.
      expect(target.registry.get(importedName)).not.toHaveProperty('exportedAt');

      const third = await new ComponentBuilder().import(again, { name: uid('third') });
      expect(html(mount(third, { a: 'yes' }))).toBe('yes');
    });
  });

  describe('import', () => {
    const data = (overrides = {}) => ({
      name: uid('imported'),
      version: '1.0.0',
      props: ['title'],
      template: '(props, state) => `<div>${props.title}</div>`',
      styles: '',
      methods: {},
      events: [],
      created: Date.now(),
      ...overrides,
    });

    test('imports from object and renders', async () => {
      const componentData = data();
      const result = await builder.import(componentData);

      expect(result).toBe(componentData.name);
      expect(builder.registry.has(componentData.name)).toBe(true);
      expect(html(mount(result, { title: 'X' }))).toBe('<div>X</div>');
    });

    test('imports the export() wrapper object', async () => {
      const componentData = data();
      const result = await builder.import({ type: 'json', data: componentData, usage: '' });
      expect(result).toBe(componentData.name);
    });

    test('imports from JSON string', async () => {
      const componentData = data();
      const result = await builder.import(JSON.stringify(componentData));
      expect(result).toBe(componentData.name);
    });

    test('imports from URL', async () => {
      const componentData = data();
      fetch.mockResolvedValueOnce(okResponse(componentData));

      const result = await builder.import('https://example.com/component.json');

      expect(result).toBe(componentData.name);
      expect(fetch).toHaveBeenCalledWith('https://example.com/component.json', undefined);
    });

    test('treats paths as URLs', async () => {
      fetch.mockResolvedValueOnce(okResponse(data()));
      await builder.import('/components/x.json');
      expect(fetch).toHaveBeenCalledWith('/components/x.json', undefined);
    });

    test('rejects non-2xx URL responses with the status', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await expect(builder.import('https://example.com/missing.json')).rejects.toThrow(
        'Request to https://example.com/missing.json failed with status 404 Not Found'
      );
    });

    test('loads from cloud by (encoded) name', async () => {
      const cloud = new ComponentBuilder({ apiEndpoint: 'https://api.example.com' });
      const componentData = data();
      fetch.mockResolvedValueOnce(okResponse(componentData));

      const result = await cloud.import('cloud component');

      expect(result).toBe(componentData.name);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/components/cloud%20component',
        undefined
      );
    });

    test('can register under a different name', async () => {
      const componentData = data();
      const newName = uid('renamed');
      expect(await builder.import(componentData, { name: newName })).toBe(newName);
      expect(builder.registry.get(newName).name).toBe(newName);
    });

    test('validates component data', async () => {
      await expect(builder.import(data({ name: 'bad' }))).rejects.toThrow(/Invalid component name/);
      await expect(builder.import(data({ template: undefined }))).rejects.toThrow(
        /template must be a function source/
      );
      await expect(builder.import(data({ template: 'not valid js (' }))).rejects.toThrow(
        /Invalid template source/
      );
      await expect(builder.import(data({ template: '42' }))).rejects.toThrow(
        /does not evaluate to a function/
      );
      await expect(builder.import(data({ props: 'title' }))).rejects.toThrow(/props must be an array/);
      await expect(builder.import(42)).rejects.toThrow(/Component source must be/);
    });

    test('a failed import leaves the registry untouched', async () => {
      const componentData = data({ methods: { broken: '{{{' } });
      await expect(builder.import(componentData)).rejects.toThrow(/Invalid method "broken"/);
      expect(builder.registry.has(componentData.name)).toBe(false);
      expect(customElements.get(componentData.name)).toBeUndefined();
    });
  });

  describe('generateScript', () => {
    test('produces a script that registers a working element without the library', async () => {
      const name = uid();
      builder.define(name, {
        props: ['step'],
        template: (props, state, { escape }) =>
          `<span>${escape(state.count)}</span><button on-click="increment"></button>`,
        styles: 'span { color: red; }',
        initialState: { count: 0 },
        methods: {
          add(amount) {
            this.setState({ count: this.state.count + amount });
          },
          increment() {
            this.add(Number(this.props.step));
          },
        },
        mounted() {
          this.setState({ count: 1 });
        },
      });
      const script = await builder.export(name, { type: 'script' });

      // Register under a fresh name, since `name` is already taken here.
      const scriptName = uid('script');
      runScript(script.split(JSON.stringify(name)).join(JSON.stringify(scriptName)));

      const a = mount(scriptName, { step: '5' });
      const b = mount(scriptName, { step: '1' });
      expect(a.shadowRoot.querySelector('style').textContent).toBe('span { color: red; }');
      a.shadowRoot.querySelector('button').click();
      expect(a.shadowRoot.querySelector('span').textContent).toBe('6');
      expect(b.shadowRoot.querySelector('span').textContent).toBe('1');
      expect(window[builder.toPascalCase(name)]).toBe(customElements.get(scriptName));
    });

    test('safely embeds styles containing backticks, ${ } and </script>', async () => {
      const styles = 'a::after { content: "` ${x} </script>"; }';
      const name = uid();
      const script = builder.generateScript({
        name,
        props: [],
        template: '() => "<a></a>"',
        styles,
        methods: {},
      });
      expect(script).not.toContain('</script>');
      runScript(script);
      expect(mount(name).shadowRoot.querySelector('style').textContent).toBe(styles);
    });

    test('warns and skips when the element is already registered', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const name = uid();
      builder.define(name, { template: () => '' });
      runScript(builder.generateScript(builder.registry.get(name)));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      warn.mockRestore();
    });

    test('rejects invalid names instead of generating broken code', () => {
      expect(() =>
        builder.generateScript({ name: 'x-y\'); alert(1); (\'', template: '() => ""' })
      ).toThrow(/Invalid component name/);
    });
  });

  describe('Helper methods', () => {
    test('toPascalCase converts kebab-case to PascalCase', () => {
      expect(builder.toPascalCase('my-component')).toBe('MyComponent');
      expect(builder.toPascalCase('test-component-name')).toBe('TestComponentName');
      expect(builder.toPascalCase('simple')).toBe('Simple');
    });

    test('serializeMethods and generateMethodsCode produce evaluable code', () => {
      const methods = builder.serializeMethods({
        shorthand(a, b = (1, 2)) {
          return a + b;
        },
        regular: function (a) {
          return a * 2;
        },
        arrow: (a) => a - 1,
        async asyncArrow(a) {
          return a;
        },
        'quoted-name'() {
          return 'quoted';
        },
        delete() {
          return 'keyword';
        },
      });
      Object.values(methods).forEach((source) => expect(typeof source).toBe('string'));

      const obj = new Function(`return { ${builder.generateMethodsCode(methods)} };`)();
      expect(obj.shorthand(1)).toBe(3);
      expect(obj.regular(2)).toBe(4);
      expect(obj.arrow(2)).toBe(1);
      expect(obj['quoted-name']()).toBe('quoted');
      expect(obj.delete()).toBe('keyword');
    });

    test('serializeMethods rejects functions that cannot be shared', () => {
      expect(() => builder.serializeMethods({ bound: function () {}.bind(null) })).toThrow(
        /native or bound/
      );
      expect(() => builder.serializeMethods({ notFn: 'x' })).toThrow(/must be a function/);
    });

    test('escapeHtml escapes HTML special characters', () => {
      expect(ComponentBuilder.escapeHtml('<a href="x">\'&\'</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
      );
      expect(ComponentBuilder.escapeHtml(null)).toBe('');
      expect(ComponentBuilder.escapeHtml(5)).toBe('5');
    });

    test('generateUsageInstructions creates instructions', () => {
      const name = uid();
      builder.define(name, { props: ['title', 'content'], template: () => '' });

      const instructions = builder.generateUsageInstructions(name);

      expect(instructions).toContain('Usage Instructions');
      expect(instructions).toContain(name);
      expect(instructions).toContain('title="value"');
      expect(instructions).toContain('content="value"');
    });
  });

  describe('Error handling', () => {
    test('cloud operations without API endpoint', async () => {
      const name = uid();
      builder.define(name, { template: () => '' });

      await expect(builder.export(name, { type: 'cloud' })).rejects.toThrow(
        'API endpoint not configured'
      );
      await expect(builder.import('some-component')).rejects.toThrow(
        'API endpoint not configured'
      );
    });

    test('propagates network errors', async () => {
      const cloud = new ComponentBuilder({ apiEndpoint: 'https://api.example.com' });
      fetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(cloud.import('test-component')).rejects.toThrow('Network error');
    });
  });
});
