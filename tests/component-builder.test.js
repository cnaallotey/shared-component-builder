import ComponentBuilder from '../src/component-builder.js';

describe('ComponentBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new ComponentBuilder();
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with default options', () => {
      expect(builder.registry).toBeInstanceOf(Map);
      expect(builder.config.localRegistry).toBe(true);
      expect(builder.config.apiEndpoint).toBe(null);
    });

    test('should create instance with custom options', () => {
      const customBuilder = new ComponentBuilder({
        apiEndpoint: 'https://api.example.com',
        localRegistry: false
      });
      
      expect(customBuilder.config.apiEndpoint).toBe('https://api.example.com');
      expect(customBuilder.config.localRegistry).toBe(false);
    });
  });

  describe('define', () => {
    test('should define a component successfully', () => {
      const componentDef = {
        version: '1.0.0',
        props: ['title', 'content'],
        template: (props, state) => `<div>${props.title}: ${props.content}</div>`,
        styles: 'div { color: blue; }'
      };

      const result = builder.define('test-component', componentDef);

      expect(result.name).toBe('test-component');
      expect(result.version).toBe('1.0.0');
      expect(result.props).toEqual(['title', 'content']);
      expect(builder.registry.has('test-component')).toBe(true);
    });

    test('should use default values when not provided', () => {
      const componentDef = {
        template: (props, state) => '<div>test</div>'
      };

      const result = builder.define('test-component', componentDef);

      expect(result.version).toBe('1.0.0');
      expect(result.props).toEqual([]);
      expect(result.styles).toBe('');
      expect(result.methods).toEqual({});
      expect(result.events).toEqual([]);
    });

    test('should serialize methods correctly', () => {
      const componentDef = {
        template: (props, state) => '<div>test</div>',
        methods: {
          testMethod() { return 'test'; },
          anotherMethod() { return 'another'; }
        }
      };

      const result = builder.define('test-component', componentDef);

      expect(typeof result.methods.testMethod).toBe('string');
      expect(typeof result.methods.anotherMethod).toBe('string');
    });
  });

  describe('export', () => {
    beforeEach(() => {
      builder.define('test-component', {
        props: ['title'],
        template: (props, state) => `<div>${props.title}</div>`,
        styles: 'div { color: red; }'
      });
    });

    test('should export as JSON by default', async () => {
      const result = await builder.export('test-component');

      expect(result.type).toBe('json');
      expect(result.data.name).toBe('test-component');
      expect(result.data.props).toEqual(['title']);
      expect(result.usage).toContain('Usage Instructions');
    });

    test('should export as script', async () => {
      const result = await builder.export('test-component', { type: 'script' });

      expect(typeof result).toBe('string');
      expect(result).toContain('test-component');
      expect(result).toContain('class TestComponent extends HTMLElement');
      expect(result).toContain('customElements.define');
    });

    test('should throw error for non-existent component', async () => {
      await expect(builder.export('non-existent')).rejects.toThrow(
        'Component non-existent not found'
      );
    });

    test('should export to cloud when configured', async () => {
      const cloudBuilder = new ComponentBuilder({
        apiEndpoint: 'https://api.example.com'
      });

      cloudBuilder.define('test-component', {
        props: ['title'],
        template: (props, state) => `<div>${props.title}</div>`
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      const result = await cloudBuilder.export('test-component', { type: 'cloud' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/components',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  describe('import', () => {
    test('should import from object', async () => {
      const componentData = {
        name: 'imported-component',
        version: '1.0.0',
        props: ['title'],
        template: '(props, state) => `<div>${props.title}</div>`',
        styles: 'div { color: blue; }',
        methods: {},
        events: [],
        created: Date.now()
      };

      const result = await builder.import(componentData);

      expect(result).toBe('imported-component');
      expect(builder.registry.has('imported-component')).toBe(true);
    });

    test('should import from JSON string', async () => {
      const componentData = {
        name: 'json-component',
        version: '1.0.0',
        props: ['title'],
        template: '(props, state) => `<div>${props.title}</div>`',
        styles: '',
        methods: {},
        events: [],
        created: Date.now()
      };

      const result = await builder.import(JSON.stringify(componentData));

      expect(result).toBe('json-component');
    });

    test('should import from URL', async () => {
      const componentData = {
        name: 'url-component',
        version: '1.0.0',
        props: ['title'],
        template: '(props, state) => `<div>${props.title}</div>`',
        styles: '',
        methods: {},
        events: [],
        created: Date.now()
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(componentData)
      });

      const result = await builder.import('https://example.com/component.json');

      expect(result).toBe('url-component');
      expect(fetch).toHaveBeenCalledWith('https://example.com/component.json');
    });

    test('should load from cloud when configured', async () => {
      const cloudBuilder = new ComponentBuilder({
        apiEndpoint: 'https://api.example.com'
      });

      const componentData = {
        name: 'cloud-component',
        version: '1.0.0',
        props: ['title'],
        template: '(props, state) => `<div>${props.title}</div>`',
        styles: '',
        methods: {},
        events: [],
        created: Date.now()
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(componentData)
      });

      const result = await cloudBuilder.import('cloud-component');

      expect(result).toBe('cloud-component');
      expect(fetch).toHaveBeenCalledWith('https://api.example.com/components/cloud-component');
    });
  });

  describe('Helper methods', () => {
    test('toPascalCase should convert kebab-case to PascalCase', () => {
      expect(builder.toPascalCase('my-component')).toBe('MyComponent');
      expect(builder.toPascalCase('test-component-name')).toBe('TestComponentName');
      expect(builder.toPascalCase('simple')).toBe('Simple');
    });

    test('generateMethodsCode should create method code', () => {
      const methods = {
        testMethod: 'return "test";',
        anotherMethod: 'return "another";'
      };

      const result = builder.generateMethodsCode(methods);

      expect(result).toContain('testMethod() { return "test"; }');
      expect(result).toContain('anotherMethod() { return "another"; }');
    });

    test('serializeMethods should convert functions to strings', () => {
      const methods = {
        testMethod: function() { return 'test'; },
        anotherMethod: () => 'another'
      };

      const result = builder.serializeMethods(methods);

      expect(typeof result.testMethod).toBe('string');
      expect(typeof result.anotherMethod).toBe('string');
      expect(result.testMethod).toContain('return \'test\'');
    });

    test('generateUsageInstructions should create instructions', () => {
      builder.define('test-component', {
        props: ['title', 'content'],
        template: (props, state) => '<div>test</div>'
      });

      const instructions = builder.generateUsageInstructions('test-component');

      expect(instructions).toContain('Usage Instructions');
      expect(instructions).toContain('test-component');
      expect(instructions).toContain('title="value"');
      expect(instructions).toContain('content="value"');
    });
  });

  describe('Error handling', () => {
    test('should handle cloud operations without API endpoint', async () => {
      builder.define('test-component', {
        props: ['title'],
        template: (props, state) => '<div>test</div>'
      });

      await expect(builder.export('test-component', { type: 'cloud' }))
        .rejects.toThrow('API endpoint not configured');

      await expect(builder.import('test-component'))
        .rejects.toThrow('API endpoint not configured');
    });

    test('should handle fetch errors gracefully', async () => {
      const cloudBuilder = new ComponentBuilder({
        apiEndpoint: 'https://api.example.com'
      });

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(cloudBuilder.import('test-component'))
        .rejects.toThrow('Network error');
    });
  });
}); 