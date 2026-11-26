/**
 * Runtime shared by live registration and by generated standalone scripts.
 *
 * Generated scripts embed this function via `createRuntime.toString()`, so it
 * MUST stay self-contained: no references to anything outside its own body.
 * The istanbul hint keeps coverage instrumentation out of the embedded source.
 */
/* istanbul ignore next */
function createRuntime() {
  // Events delegated from the shadow root to `on-<event>="method"` attributes.
  var DELEGATED_EVENTS = [
    'click',
    'dblclick',
    'input',
    'change',
    'submit',
    'keydown',
    'keyup',
    'focusin',
    'focusout',
    'pointerdown',
    'pointerup',
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createElementClass(def) {
    var observed = (def.props || []).slice();
    var methods = def.methods || {};
    var helpers = { escape: escapeHtml };

    class SharedComponent extends HTMLElement {
      static get observedAttributes() {
        return observed;
      }

      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.props = {};
        // Each instance gets its own copy so instances never share state.
        this.state = def.initialState
          ? JSON.parse(JSON.stringify(def.initialState))
          : {};
        this._connected = false;
        var host = this;
        DELEGATED_EVENTS.forEach(function (type) {
          host.shadowRoot.addEventListener(type, function (event) {
            host._dispatchToMethod(event);
          });
        });
      }

      connectedCallback() {
        this._connected = true;
        this.updateProps();
        this.render();
        if (def.mounted) def.mounted.call(this);
      }

      disconnectedCallback() {
        this._connected = false;
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        this.props[name] = newValue == null ? '' : newValue;
        // Initial attributes are handled in connectedCallback; avoid one
        // render per attribute while the element is being upgraded.
        if (this._connected) this.render();
      }

      updateProps() {
        var host = this;
        observed.forEach(function (prop) {
          var value = host.getAttribute(prop);
          host.props[prop] = value == null ? '' : value;
        });
      }

      render() {
        var html = def.template.call(this, this.props, this.state, helpers);
        var styles = def.styles ? '<style>' + def.styles + '</style>' : '';
        this.shadowRoot.innerHTML = styles + html;
      }

      setState(partial) {
        this.state = Object.assign({}, this.state, partial);
        if (this._connected) this.render();
      }

      emit(name, detail) {
        return this.dispatchEvent(
          new CustomEvent(name, {
            detail: detail,
            bubbles: true,
            composed: true,
          })
        );
      }

      _dispatchToMethod(event) {
        var attr = 'on-' + event.type;
        var path = event.composedPath();
        for (var i = 0; i < path.length; i++) {
          var el = path[i];
          if (el === this.shadowRoot) return;
          if (el.hasAttribute && el.hasAttribute(attr)) {
            var methodName = el.getAttribute(attr);
            if (typeof this[methodName] === 'function') {
              this[methodName](event, el);
            } else {
              console.warn(
                '<' +
                  this.localName +
                  '>: no method "' +
                  methodName +
                  '" for ' +
                  attr
              );
            }
            return;
          }
        }
      }
    }

    Object.keys(methods).forEach(function (name) {
      SharedComponent.prototype[name] = methods[name];
    });

    return SharedComponent;
  }

  return { createElementClass: createElementClass, escapeHtml: escapeHtml };
}

const runtime = createRuntime();

const CUSTOM_ELEMENT_NAME = /^[a-z][-.0-9_a-z]*-[-.0-9_a-z]*$/;
const RESERVED_NAMES = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
]);
const DEFINITION_KEYS = new Set([
  'name',
  'version',
  'props',
  'template',
  'styles',
  'methods',
  'events',
  'initialState',
  'mounted',
  'created',
]);

function hasCustomElements() {
  return typeof customElements !== 'undefined';
}

function assertValidName(name) {
  if (
    typeof name !== 'string' ||
    !CUSTOM_ELEMENT_NAME.test(name) ||
    RESERVED_NAMES.has(name)
  ) {
    throw new TypeError(
      `Invalid component name "${name}": use lowercase letters, digits, ".", "_" and at least one "-" (e.g. "my-button")`
    );
  }
}

function cloneJson(value, label) {
  if (value == null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new TypeError(`${label} must be JSON-serializable: ${error.message}`);
  }
}

/** Index of the ")" matching the "(" at `openIndex`, skipping strings and comments. */
function findClosingParen(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === '\'' || ch === '`') {
      for (i++; i < source.length && source[i] !== ch; i++) {
        if (source[i] === '\\') i++;
      }
    } else if (ch === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2) + 1 || source.length;
    } else if (ch === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i) === -1 ? source.length : source.indexOf('\n', i);
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Turn a function into source text that evaluates as an expression.
 * Arrow functions and function expressions are kept as-is; method shorthand
 * (`name(a) { ... }`) is rewritten to `function (a) { ... }`.
 */
function functionToSource(fn, label) {
  if (typeof fn !== 'function') {
    throw new TypeError(`${label} must be a function`);
  }
  const source = fn.toString().trim();
  if (/\[native code\]\s*\}$/.test(source)) {
    throw new TypeError(`${label} cannot be a native or bound function`);
  }
  if (/^class\b/.test(source)) {
    throw new TypeError(`${label} cannot be a class`);
  }
  if (/^(async\s+)?function\b/.test(source)) return source;

  const method = source.match(
    /^(async\s+)?(\*\s*)?([$\w]+|\[[^\]]*\]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\(/
  );
  if (method) {
    const openIndex = method[0].length - 1;
    const closeIndex = findClosingParen(source, openIndex);
    const isArrow =
      closeIndex !== -1 && source.slice(closeIndex + 1).trimStart().startsWith('=>');
    if (!isArrow) {
      return `${method[1] || ''}function${method[2] ? '*' : ''} ${source.slice(openIndex)}`;
    }
  }
  return source; // arrow function
}

/** Inverse of functionToSource. */
function sourceToFunction(source, label) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new TypeError(`${label} must be a function source string`);
  }
  let fn;
  try {
    fn = new Function(`return (${source});`)();
  } catch (error) {
    throw new SyntaxError(`Invalid ${label} source: ${error.message}`);
  }
  if (typeof fn !== 'function') {
    throw new TypeError(`${label} source does not evaluate to a function`);
  }
  return fn;
}

/** JSON literal that is also safe to inline inside an HTML <script> tag. */
function toJsLiteral(value) {
  return JSON.stringify(value === undefined ? null : value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * ComponentBuilder - A tool for creating, sharing, and reusing web components
 * @class ComponentBuilder
 */
class ComponentBuilder {
  /**
   * Create a new ComponentBuilder instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiEndpoint] - API endpoint for cloud storage
   */
  constructor(options = {}) {
    this.registry = new Map();
    this.config = {
      apiEndpoint: null,
      ...options,
    };
  }

  /**
   * Escape a value for safe interpolation into HTML.
   * Also passed to templates as `helpers.escape`.
   * @param {*} value
   * @returns {string}
   */
  static escapeHtml(value) {
    return runtime.escapeHtml(value);
  }

  /**
   * Define a component and register it as a custom element (in browsers).
   * @param {string} name - Custom element name (must contain a hyphen)
   * @param {Object} definition - Component definition
   * @returns {Object} Serializable component data
   */
  define(name, definition = {}) {
    assertValidName(name);
    if (typeof definition.template !== 'function') {
      throw new TypeError(`Component "${name}" needs a template function`);
    }
    this.assertNotDefined(name);

    const metadata = Object.fromEntries(
      Object.entries(definition).filter(
        ([key, value]) => !DEFINITION_KEYS.has(key) && typeof value !== 'function'
      )
    );

    const componentData = {
      ...metadata,
      name,
      version: definition.version || '1.0.0',
      props: [...(definition.props || [])],
      template: functionToSource(definition.template, 'template'),
      styles: definition.styles || '',
      methods: definition.methods ? this.serializeMethods(definition.methods) : {},
      events: [...(definition.events || [])],
      initialState: cloneJson(definition.initialState, 'initialState') || {},
      mounted: definition.mounted
        ? functionToSource(definition.mounted, 'mounted')
        : null,
      created: Date.now(),
    };

    // Register first so a failure leaves the registry untouched.
    this.registerWebComponent(name, {
      props: componentData.props,
      template: definition.template,
      styles: componentData.styles,
      methods: definition.methods || {},
      initialState: componentData.initialState,
      mounted: definition.mounted || null,
    });
    this.registry.set(name, componentData);

    return componentData;
  }

  /**
   * Export component for sharing
   * @param {string} componentName - Name of component to export
   * @param {Object} options - Export options
   * @returns {Promise<Object|string>} Exported component data or script
   */
  async export(componentName, options = {}) {
    const component = this.registry.get(componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }

    const exportData = {
      ...component,
      exportedAt: Date.now(),
      exportOptions: options,
    };

    if (options.type === 'script') {
      return this.generateScript(exportData);
    }

    if (options.type === 'cloud') {
      if (!this.config.apiEndpoint) {
        throw new Error('API endpoint not configured');
      }
      return await this.saveToCloud(exportData);
    }

    return {
      type: 'json',
      data: exportData,
      usage: this.generateUsageInstructions(componentName),
    };
  }

  /**
   * Import a component.
   * @param {string|Object} source - URL, JSON string, cloud component name,
   *   component data object, or the result of `export()` with type 'json'
   * @param {Object} [options]
   * @param {string} [options.name] - Register under a different name
   * @returns {Promise<string>} Registered component name
   */
  async import(source, options = {}) {
    let componentData;

    if (typeof source === 'string') {
      const value = source.trim();
      if (value.startsWith('{')) {
        componentData = JSON.parse(value);
      } else if (/^(https?:)?\/\//i.test(value) || /^\.{0,2}\//.test(value)) {
        componentData = await this.fetchJson(value);
      } else {
        if (!this.config.apiEndpoint) {
          throw new Error('API endpoint not configured');
        }
        componentData = await this.loadFromCloud(value);
      }
    } else if (source && typeof source === 'object') {
      componentData = source;
    } else {
      throw new TypeError(
        'Component source must be a URL, JSON string, component name, or object'
      );
    }

    // Accept the wrapper returned by export({ type: 'json' }).
    if (componentData && componentData.type === 'json' && componentData.data) {
      componentData = componentData.data;
    }

    return this.registerFromData(componentData, options);
  }

  /**
   * Generate a standalone script that registers the component without this
   * library.
   * @param {Object} componentData - Component data
   * @returns {string} Generated script
   */
  generateScript(componentData) {
    const { name } = componentData;
    assertValidName(name);
    const props = componentData.props || [];

    return `// Generated component script for ${name}
(function () {
  'use strict';
  var name = ${toJsLiteral(name)};
  if (customElements.get(name)) {
    console.warn('Component ' + name + ' already registered');
    return;
  }
  var runtime = (${createRuntime.toString()})();
  var ElementClass = runtime.createElementClass({
    props: ${toJsLiteral(props)},
    styles: ${toJsLiteral(componentData.styles || '')},
    initialState: ${toJsLiteral(componentData.initialState || {})},
    template: ${componentData.template},
    mounted: ${componentData.mounted || 'null'},
    methods: {
      ${this.generateMethodsCode(componentData.methods || {})}
    }
  });
  customElements.define(name, ElementClass);
  // Expose for manual instantiation
  window[${toJsLiteral(this.toPascalCase(name))}] = ElementClass;
})();

// Usage:
// <${name} ${props.map((p) => `${p}="value"`).join(' ')}></${name}>
`;
  }

  /**
   * Register a custom element from a definition holding real functions.
   * No-op (returns false) where custom elements are unavailable, e.g. Node.
   * @param {string} name - Component name
   * @param {Object} definition - Component definition
   * @returns {boolean} Whether a custom element was registered
   */
  registerWebComponent(name, definition) {
    if (!hasCustomElements()) return false;
    if (customElements.get(name)) {
      throw new Error(
        `Custom element "${name}" is already defined and cannot be redefined`
      );
    }
    customElements.define(name, runtime.createElementClass(definition));
    return true;
  }

  /**
   * Serialize methods for storage
   * @param {Object} methods - Methods object
   * @returns {Object} Method name to function source
   */
  serializeMethods(methods) {
    const serialized = {};
    Object.keys(methods).forEach((key) => {
      serialized[key] = functionToSource(methods[key], `method "${key}"`);
    });
    return serialized;
  }

  /**
   * Generate object-literal entries for serialized methods
   * @param {Object} methods - Method name to function source
   * @returns {string} Generated code
   */
  generateMethodsCode(methods) {
    return Object.keys(methods)
      .map((name) => `${toJsLiteral(name)}: ${methods[name]}`)
      .join(',\n      ');
  }

  /**
   * Convert string to PascalCase
   * @param {string} str - Input string
   * @returns {string} PascalCase string
   */
  toPascalCase(str) {
    return str.replace(/(^\w|-\w)/g, (match) =>
      match.replace('-', '').toUpperCase()
    );
  }

  /**
   * Generate usage instructions
   * @param {string} componentName - Component name
   * @returns {string} Usage instructions
   */
  generateUsageInstructions(componentName) {
    const component = this.registry.get(componentName);
    const attrs = component.props.map((p) => `${p}="value"`).join(' ');
    return `
Usage Instructions:
1. In Project B, import this data: await builder.import(exportedJson)
   (or export with { type: 'script' } and include that file with a <script> tag)
2. Use the component: <${componentName} ${attrs}></${componentName}>
`;
  }

  /**
   * Fetch JSON, throwing on non-2xx responses
   * @param {string} url
   * @param {Object} [init] - fetch options
   * @returns {Promise<Object>}
   */
  async fetchJson(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(
        `Request to ${url} failed with status ${response.status}${
          response.statusText ? ` ${response.statusText}` : ''
        }`
      );
    }
    return response.json();
  }

  /**
   * Save component to cloud storage
   * @param {Object} componentData - Component data
   * @returns {Promise<Object>} Response from cloud storage
   */
  async saveToCloud(componentData) {
    if (!this.config.apiEndpoint) {
      throw new Error('API endpoint not configured');
    }
    return this.fetchJson(`${this.endpoint()}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(componentData),
    });
  }

  /**
   * Load component from cloud storage
   * @param {string} componentName - Component name
   * @returns {Promise<Object>} Component data
   */
  async loadFromCloud(componentName) {
    if (!this.config.apiEndpoint) {
      throw new Error('API endpoint not configured');
    }
    return this.fetchJson(
      `${this.endpoint()}/components/${encodeURIComponent(componentName)}`
    );
  }

  /**
   * Register component from serialized data.
   * Function sources in the data are evaluated, so only import components
   * from sources you trust.
   * @param {Object} componentData - Component data
   * @param {Object} [options]
   * @param {string} [options.name] - Register under a different name
   * @returns {string} Registered component name
   */
  registerFromData(componentData, options = {}) {
    if (!componentData || typeof componentData !== 'object') {
      throw new TypeError('Component data must be an object');
    }
    const name = options.name || componentData.name;
    assertValidName(name);
    if (componentData.props != null && !Array.isArray(componentData.props)) {
      throw new TypeError(`Component "${name}" props must be an array`);
    }
    this.assertNotDefined(name);

    const methods = {};
    Object.entries(componentData.methods || {}).forEach(([key, source]) => {
      methods[key] = sourceToFunction(source, `method "${key}"`);
    });

    this.registerWebComponent(name, {
      props: componentData.props || [],
      template: sourceToFunction(componentData.template, 'template'),
      styles: componentData.styles || '',
      methods,
      initialState: componentData.initialState || {},
      mounted: componentData.mounted
        ? sourceToFunction(componentData.mounted, 'mounted')
        : null,
    });

    // eslint-disable-next-line no-unused-vars
    const { exportedAt, exportOptions, ...data } = componentData;
    this.registry.set(name, {
      ...data,
      name,
      props: componentData.props || [],
      styles: componentData.styles || '',
      methods: componentData.methods || {},
      events: componentData.events || [],
      initialState: componentData.initialState || {},
      mounted: componentData.mounted || null,
    });

    return name;
  }

  /** @private */
  assertNotDefined(name) {
    if (this.registry.has(name) || (hasCustomElements() && customElements.get(name))) {
      throw new Error(
        `Component "${name}" is already defined; custom elements cannot be redefined, so use a different name`
      );
    }
  }

  /** @private */
  endpoint() {
    return String(this.config.apiEndpoint).replace(/\/+$/, '');
  }
}

export default ComponentBuilder;

// For UMD/browser usage
if (typeof window !== 'undefined') {
  window.ComponentBuilder = ComponentBuilder;
}
