// Mock customElements for testing
if (typeof customElements === 'undefined') {
  global.customElements = {
    define: jest.fn(),
    get: jest.fn(() => undefined),
    whenDefined: jest.fn(() => Promise.resolve())
  };
}

// Mock HTMLElement for testing
if (typeof HTMLElement === 'undefined') {
  global.HTMLElement = class HTMLElement {
    constructor() {
      this.attributes = new Map();
      this.shadowRoot = {
        innerHTML: ''
      };
    }
    
    getAttribute(name) {
      return this.attributes.get(name);
    }
    
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    
    attachShadow(options) {
      this.shadowRoot = {
        innerHTML: '',
        mode: options.mode
      };
      return this.shadowRoot;
    }
    
    dispatchEvent(event) {
      // Mock event dispatch
    }
  };
}

// Mock fetch for testing
global.fetch = jest.fn();

// Console mock to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
}; 