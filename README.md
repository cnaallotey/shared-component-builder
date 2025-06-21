# Shared Component Builder

A powerful tool for creating, sharing, and reusing web components across projects. Build components once and use them everywhere!

## 🚀 Features

- **Define Components**: Create reusable web components with templates, styles, and methods
- **Export Options**: Generate standalone scripts, save to cloud, or export as JSON
- **Import Flexibility**: Import from URLs, JSON strings, or cloud storage
- **Auto-Registration**: Automatically registers components as custom elements
- **TypeScript Support**: Full TypeScript definitions included
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
  template: (props, state) => `
    <div class="banner banner--${props.type || 'info'}">
      <span>${props.message}</span>
      ${props.closable === 'true' ? '<button onclick="this.remove()">×</button>' : ''}
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
  `
});

// Export for sharing
const script = await builder.export('my-custom-banner', { type: 'script' });
console.log('Share this script with Project B:', script);
```

### Project B: Import and Use the Component

```javascript
import ComponentBuilder from 'shared-component-builder';

const builder = new ComponentBuilder();

// Import the component (multiple ways)
// Option 1: From generated script
builder.import(scriptContentFromProjectA);

// Option 2: From URL
builder.import('https://yourcdn.com/components/my-custom-banner.js');

// Option 3: From JSON
builder.import(jsonDataFromProjectA);

// Now use it in your HTML
// <my-custom-banner message="Hello World!" type="success" closable="true"></my-custom-banner>
```

## 📚 API Reference

### Constructor

```javascript
new ComponentBuilder(options)
```

**Options:**
- `apiEndpoint` (string): API endpoint for cloud storage
- `localRegistry` (boolean): Whether to use local registry (default: true)

### Methods

#### `define(name, definition)`

Define a new component.

```javascript
builder.define('my-component', {
  version: '1.0.0',
  props: ['title', 'content'],
  template: (props, state) => `<div>${props.title}: ${props.content}</div>`,
  styles: 'div { color: blue; }',
  methods: {
    updateContent(newContent) {
      this.props.content = newContent;
      this.render();
    }
  },
  initialState: { count: 0 },
  mounted() {
    console.log('Component mounted!');
  }
});
```

#### `export(componentName, options)`

Export a component for sharing.

```javascript
// Generate standalone script
const script = await builder.export('my-component', { type: 'script' });

// Save to cloud
const result = await builder.export('my-component', { type: 'cloud' });

// Export as JSON
const json = await builder.export('my-component', { type: 'json' });
```

#### `import(source, options)`

Import a component from various sources.

```javascript
// From URL
await builder.import('https://example.com/component.json');

// From JSON string
await builder.import('{"name": "my-component", ...}');

// From object
await builder.import(componentData);

// From cloud by name
await builder.import('my-component');
```

## 🔧 Configuration

### Cloud Storage Setup

```javascript
const builder = new ComponentBuilder({
  apiEndpoint: 'https://your-api.com/api'
});
```

### Local Registry Only

```javascript
const builder = new ComponentBuilder({
  localRegistry: true,
  apiEndpoint: null
});
```

## 📁 Project Structure

```
shared-component-builder/
├── src/
│   ├── component-builder.js    # Main source file
│   └── component-builder.d.ts  # TypeScript definitions
├── dist/                       # Built files (generated)
├── package.json
├── rollup.config.js
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

### Advanced Component with Methods

```javascript
builder.define('counter-component', {
  props: ['initial', 'step'],
  template: (props, state) => `
    <div class="counter">
      <span>Count: ${state.count}</span>
      <button onclick="this.increment()">+</button>
      <button onclick="this.decrement()">-</button>
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
    this.state.count = parseInt(this.props.initial || 0);
  }
});
```

### Component with Events

```javascript
builder.define('modal-component', {
  props: ['title', 'visible'],
  template: (props, state) => `
    <div class="modal ${props.visible === 'true' ? 'visible' : ''}">
      <div class="modal-content">
        <h2>${props.title}</h2>
        <slot></slot>
        <button onclick="this.close()">Close</button>
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
      this.dispatchEvent(new CustomEvent('modal-close'));
      this.setAttribute('visible', 'false');
    }
  }
});
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

1. Check the [documentation](https://github.com/yourusername/shared-component-builder#readme)
2. Search [existing issues](https://github.com/yourusername/shared-component-builder/issues)
3. Create a [new issue](https://github.com/yourusername/shared-component-builder/issues/new)

## 🙏 Acknowledgments

- Built with modern JavaScript standards
- Inspired by the need for better component sharing across projects
- Thanks to the web components community for the foundation 