/**
 * ComponentBuilder - A powerful tool for creating, sharing, and reusing web components
 * @class ComponentBuilder
 */
class ComponentBuilder {
  /**
   * Create a new ComponentBuilder instance
   * @param {Object} options - Configuration options
   * @param {string} options.apiEndpoint - API endpoint for cloud storage
   * @param {boolean} options.localRegistry - Whether to use local registry
   */
  constructor(options = {}) {
    this.registry = new Map();
    this.config = {
      apiEndpoint: options.apiEndpoint || null,
      localRegistry: options.localRegistry || true,
      ...options
    };
  }

  /**
   * Define a component in Project A
   * @param {string} name - Component name
   * @param {Object} definition - Component definition
   * @returns {Object} Component definition
   */
  define(name, definition) {
    // Always serialize methods to strings
    const serializedMethods = definition.methods ? this.serializeMethods(definition.methods) : {};
    const componentDef = {
      name,
      version: definition.version || '1.0.0',
      props: definition.props || [],
      template: definition.template.toString(),
      styles: definition.styles || '',
      methods: serializedMethods,
      events: definition.events || [],
      created: Date.now(),
      // Only spread properties that do not overwrite the above
      ...Object.fromEntries(Object.entries(definition).filter(([k]) => !['version','props','template','styles','methods','events'].includes(k)))
    };
    this.registry.set(name, componentDef);
    
    // Auto-register as web component
    this.registerWebComponent(name, definition);
    
    return componentDef;
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
      exportOptions: options
    };

    // Option 1: Generate a standalone script
    if (options.type === 'script') {
      return this.generateScript(exportData);
    }

    // Option 2: Save to API/Cloud
    if (options.type === 'cloud') {
      if (!this.config.apiEndpoint) {
        throw new Error('API endpoint not configured');
      }
      return await this.saveToCloud(exportData);
    }

    // Option 3: Generate JSON for manual sharing
    return {
      type: 'json',
      data: exportData,
      usage: this.generateUsageInstructions(componentName)
    };
  }

  /**
   * Import component in Project B
   * @param {string|Object} source - Component source (URL, JSON string, or object)
   * @param {Object} options - Import options
   * @returns {Promise<string>} Registered component name
   */
  async import(source, options = {}) {
    let componentData;

    if (typeof source === 'string') {
      if (source.startsWith('http')) {
        // Load from URL
        componentData = await fetch(source).then(r => r.json());
      } else if (source.startsWith('{')) {
        // Parse JSON string
        componentData = JSON.parse(source);
      } else {
        // Load from cloud by name
        if (!this.config.apiEndpoint) {
          throw new Error('API endpoint not configured');
        }
        componentData = await this.loadFromCloud(source);
      }
    } else {
      // Direct object
      componentData = source;
    }

    return this.registerFromData(componentData, options);
  }

  /**
   * Generate standalone script for sharing
   * @param {Object} componentData - Component data
   * @returns {string} Generated script
   */
  generateScript(componentData) {
    return `
// Generated component script for ${componentData.name}
(function() {
  'use strict';
  
  if (customElements.get('${componentData.name}')) {
    console.warn('Component ${componentData.name} already registered');
    return;
  }

  class ${this.toPascalCase(componentData.name)} extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.props = {};
      this.state = {};
    }

    static get observedAttributes() {
      return ${JSON.stringify(componentData.props)};
    }

    connectedCallback() {
      this.updateProps();
      this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) {
        this.props[name] = newValue;
        this.render();
      }
    }

    updateProps() {
      ${JSON.stringify(componentData.props)}.forEach(prop => {
        this.props[prop] = this.getAttribute(prop) || '';
      });
    }

    render() {
      const template = ${componentData.template};
      const html = template.call(this, this.props, this.state);
      const styles = \`${componentData.styles}\`;
      this.shadowRoot.innerHTML = styles ? \`<style>\${styles}</style>\${html}\` : html;
    }

    ${this.generateMethodsCode(componentData.methods)}
  }

  customElements.define('${componentData.name}', ${this.toPascalCase(componentData.name)});
  
  // Expose for manual instantiation
  window.${this.toPascalCase(componentData.name)} = ${this.toPascalCase(componentData.name)};
})();

// Usage instructions:
// <${componentData.name} ${componentData.props.map(p => `${p}="value"`).join(' ')}></${componentData.name}>
`;
  }

  /**
   * Register web component from definition
   * @param {string} name - Component name
   * @param {Object} definition - Component definition
   */
  registerWebComponent(name, definition) {
    if (customElements.get(name)) return;

    const builder = this;
    
    class GeneratedComponent extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.props = {};
        this.state = definition.initialState || {};
      }

      static get observedAttributes() {
        return definition.props || [];
      }

      connectedCallback() {
        this.updateProps();
        this.render();
        if (definition.mounted) definition.mounted.call(this);
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
          this.props[name] = newValue;
          this.render();
        }
      }

      updateProps() {
        (definition.props || []).forEach(prop => {
          this.props[prop] = this.getAttribute(prop) || '';
        });
      }

      render() {
        const html = definition.template.call(this, this.props, this.state);
        const styles = definition.styles ? `<style>${definition.styles}</style>` : '';
        this.shadowRoot.innerHTML = styles + html;
      }

      setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
      }
    }

    // Add custom methods
    if (definition.methods) {
      Object.keys(definition.methods).forEach(methodName => {
        GeneratedComponent.prototype[methodName] = definition.methods[methodName];
      });
    }

    customElements.define(name, GeneratedComponent);
  }

  /**
   * Serialize methods for storage
   * @param {Object} methods - Methods object
   * @returns {Object} Serialized methods
   */
  serializeMethods(methods) {
    const serialized = {};
    Object.keys(methods).forEach(key => {
      serialized[key] = methods[key].toString();
    });
    return serialized;
  }

  /**
   * Generate methods code for script generation
   * @param {Object} methods - Methods object
   * @returns {string} Generated methods code
   */
  generateMethodsCode(methods) {
    return Object.keys(methods).map(name => {
      return `${name}() { ${methods[name]} }`;
    }).join('\n    ');
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
    return `
Usage Instructions:
1. Copy the generated script to Project B
2. Include it in your HTML: <script src="path/to/${componentName}.js"></script>
3. Use the component: <${componentName} ${component.props.map(p => `${p}="value"`).join(' ')}></${componentName}>
`;
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
    
    const response = await fetch(`${this.config.apiEndpoint}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(componentData)
    });
    
    return response.json();
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
    
    const response = await fetch(`${this.config.apiEndpoint}/components/${componentName}`);
    return response.json();
  }

  /**
   * Register component from data
   * @param {Object} componentData - Component data
   * @param {Object} options - Registration options
   * @returns {string} Registered component name
   */
  registerFromData(componentData, options = {}) {
    const definition = {
      props: componentData.props,
      template: new Function('props', 'state', `return \`${componentData.template.replace(/`/g, '\\`')}\``),
      styles: componentData.styles,
      methods: {},
      ...options
    };

    // Reconstruct methods
    if (componentData.methods) {
      Object.keys(componentData.methods).forEach(methodName => {
        definition.methods[methodName] = new Function('return ' + componentData.methods[methodName])();
      });
    }

    this.registerWebComponent(componentData.name, definition);
    this.registry.set(componentData.name, componentData);
    
    return componentData.name;
  }
}

// Export the main class
export default ComponentBuilder;

// For UMD/browser usage
if (typeof window !== 'undefined') {
  window.ComponentBuilder = ComponentBuilder;
} 