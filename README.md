# Shared Component Builder

A tool for creating, sharing, and reusing web components across projects. Build components once and use them everywhere!

## 🚀 Features

- **Define Components**: Create reusable web components with templates, styles, state, and methods
- **Export Options**: Generate standalone scripts, save to cloud, or export as JSON
- **Import Flexibility**: Import from URLs, JSON strings, objects, or cloud storage
- **Auto-Registration**: Automatically registers components as custom elements
- **Declarative Events**: Wire template elements to methods with `on-click="method"`
- **TypeScript Support**: TypeScript definitions included
- **Multiple Formats**: Supports CommonJS, ES Modules, and UMD

## 📦 Installation

```bash
npm install shared-component-builder
```

## 🎯 Quick Start

### Project A: Create and Export a Component

```javascript
import ComponentBuilder from 'shared-component-builder';

const builder = new ComponentBuilder();

// Define your component
builder.define('my-custom-banner', {
  version: '1.0.0',
  props: ['message', 'type', 'closable'],
  template: (props, state, { escape }) => `
    <div class="banner banner--${escape(props.type || 'info')}">
      <span>${escape(props.message)}</span>
      ${props.closable === 'true' ? '<button on-click="close">×</button>' : ''}
    </div>
  `,
  styles: `
    .banner {
      padding: 12px 16px;
      border-radius: 4px;
      margin: 8px 0;
    }
    .banner--info { background: #e3f2fd; color: #1565c0; }
    .banner--success { background: #e8f5e8; color: #2e7d32; }
    .banner--error { background: #ffebee; color: #c62828; }
    button {
      float: right;
      background: none;
      border: none;
      cursor: pointer;
    }
  `,
  methods: {
    close() {
      this.remove();
    }
  }
});

// Export for sharing
const json = await builder.export('my-custom-banner'); // JSON
const script = await builder.export('my-custom-banner', { type: 'script' }); // standalone JS
```

### Project B: Import and Use the Component

```javascript
import ComponentBuilder from 'shared-component-builder';

const builder = new ComponentBuilder();

// Option 1: From the JSON export (the export() result or its .data)
await builder.import(jsonFromProjectA);

// Option 2: From a URL serving that JSON
await builder.import('https://yourcdn.com/components/my-custom-banner.json');

// Option 3: From cloud storage by name (needs apiEndpoint)
await builder.import('my-custom-banner');

// Now use it in your HTML
// <my-custom-banner message="Hello World!" type="success" closable="true"></my-custom-banner>
```

A script export doesn't need this library at all. Include it with a `<script>` tag:

```html
<script src="my-custom-banner.js"></script>
<my-custom-banner message="Hello!"></my-custom-banner>
```

## ⚠️ Writing Shareable Components

Components are shared as **source text**, so:

- **Templates, methods, and `mounted` must be self-contained.** They can't use variables, imports, or helpers from the surrounding file; those don't exist in the project that imports the component.
- **Use regular functions or method shorthand for `methods` and `mounted`**, not arrow functions, so that `this` is the element.
- **`initialState` must be JSON-serializable.** Each element instance gets its own copy.
- **Importing runs code.** `import()` evaluates the component's function sources, so only import from URLs and APIs you trust.

## 📚 API Reference

### Constructor

```javascript
new ComponentBuilder(options)
```

**Options:**
- `apiEndpoint` (string): API endpoint for cloud storage (`POST {apiEndpoint}/components`, `GET {apiEndpoint}/components/:name`)

### Methods

#### `define(name, definition)`

Define a new component. `name` must be a valid custom element name (lowercase, containing a `-`). Custom elements can't be redefined, so defining an existing name throws.

```javascript
builder.define('my-component', {
  version: '1.0.0',
  props: ['title', 'content'],
  template: (props, state, { escape }) => `
    <div>${escape(props.title)}: ${escape(props.content)} (${state.clicks})</div>
    <button on-click="handleClick">Click</button>
  `,
  styles: 'div { color: blue; }',
  methods: {
    handleClick(event, element) {
      this.setState({ clicks: this.state.clicks + 1 });
      this.emit('my-component-click', { clicks: this.state.clicks });
    }
  },
  initialState: { clicks: 0 },
  mounted() {
    console.log('Component mounted!');
  }
});
```

**Template** – `(props, state, helpers) => string`. `props` holds the current attribute values (strings). `helpers.escape(value)` HTML-escapes a value. Props are **not** escaped automatically, so escape anything that could contain user input.

**Events** – Put `on-<event>="methodName"` on an element in the template to call `this.methodName(event, element)`. Supported events: `click`, `dblclick`, `input`, `change`, `submit`, `keydown`, `keyup`, `focusin`, `focusout`, `pointerdown`, `pointerup`.

**Element API** (available as `this` in methods and `mounted`):
- `this.props`, `this.state`
- `this.setState(partial)` – merges state and re-renders
- `this.render()` – re-renders
- `this.emit(name, detail)` – dispatches a bubbling, composed `CustomEvent`

`mounted()` runs after the first render. To change state there, call `setState` so the element re-renders.

#### `export(componentName, options)`

Export a component for sharing.

```javascript
// Generate standalone script
const script = await builder.export('my-component', { type: 'script' });

// Save to cloud
const result = await builder.export('my-component', { type: 'cloud' });

// Export as JSON (default)
const json = await builder.export('my-component', { type: 'json' });
```

#### `import(source, options)`

Import a component from various sources. Pass `{ name: 'other-name' }` to register it under a different name.

```javascript
// From URL (absolute, protocol-relative, or path)
await builder.import('https://example.com/component.json');

// From JSON string
await builder.import('{"name": "my-component", ...}');

// From object (component data or a JSON export result)
await builder.import(componentData);

// From cloud by name
await builder.import('my-component');
```

Failed HTTP responses (non-2xx) are rejected with an error that includes the status.

#### `ComponentBuilder.escapeHtml(value)`

The same escaping function that templates receive as `helpers.escape`.

### Node.js

In Node there's no `customElements`, so `define()` and `import()` only update the registry and don't register an element. That's useful for generating script exports at build time (see `examples/node-usage.js`).

## 🔧 Configuration

### Cloud Storage Setup

```javascript
const builder = new ComponentBuilder({
  apiEndpoint: 'https://your-api.com/api'
});
```

## 📁 Project Structure

```
shared-component-builder/
├── src/
│   ├── component-builder.js    # Main source file
│   └── component-builder.d.ts  # TypeScript definitions
├── tests/                      # Jest tests (jsdom)
├── examples/                   # Browser and Node examples
├── dist/                       # Built files (generated)
├── package.json
├── rollup.config.mjs
├── .babelrc
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## 🛠️ Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## 📦 Build Outputs

The package builds to multiple formats:

- **CommonJS**: `dist/component-builder.js`
- **ES Modules**: `dist/component-builder.esm.js`
- **UMD**: `dist/component-builder.umd.js`
- **TypeScript**: `dist/component-builder.d.ts`

## 🌟 Examples

### Component with State and Methods

```javascript
builder.define('counter-component', {
  props: ['initial', 'step'],
  template: (props, state) => `
    <div class="counter">
      <span>Count: ${state.count}</span>
      <button on-click="increment">+</button>
      <button on-click="decrement">-</button>
    </div>
  `,
  styles: `
    .counter { display: flex; align-items: center; gap: 10px; }
    button { padding: 5px 10px; }
  `,
  methods: {
    increment() {
      this.setState({ count: this.state.count + parseInt(this.props.step || 1) });
    },
    decrement() {
      this.setState({ count: this.state.count - parseInt(this.props.step || 1) });
    }
  },
  initialState: { count: 0 },
  mounted() {
    this.setState({ count: parseInt(this.props.initial || 0) });
  }
});
```

### Component with Events

```javascript
builder.define('modal-component', {
  props: ['title', 'visible'],
  template: (props, state, { escape }) => `
    <div class="modal ${props.visible === 'true' ? 'visible' : ''}">
      <div class="modal-content">
        <h2>${escape(props.title)}</h2>
        <slot></slot>
        <button on-click="close">Close</button>
      </div>
    </div>
  `,
  styles: `
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; }
    .modal.visible { display: block; }
    .modal-content { background: white; padding: 20px; margin: 10% auto; max-width: 500px; }
  `,
  methods: {
    close() {
      this.emit('modal-close');
      this.setAttribute('visible', 'false');
    }
  }
});

document.addEventListener('modal-close', () => console.log('Modal was closed!'));
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions, please:

1. Check the [documentation](https://github.com/cnaallotey/shared-component-builder#readme)
2. Search [existing issues](https://github.com/cnaallotey/shared-component-builder/issues)
3. Create a [new issue](https://github.com/cnaallotey/shared-component-builder/issues/new)

## 🙏 Acknowledgments

- Built with modern JavaScript standards
- Inspired by the need for better component sharing across projects
- Thanks to the web components community for the foundation
