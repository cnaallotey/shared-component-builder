/**
 * @jest-environment node
 */
import ComponentBuilder from '../src/component-builder.js';

describe('ComponentBuilder in Node (no customElements)', () => {
  test('define, export and import work without registering elements', async () => {
    expect(typeof customElements).toBe('undefined');
    const builder = new ComponentBuilder();

    const data = builder.define('node-comp', {
      props: ['a'],
      template: (props) => `<p>${props.a}</p>`,
      methods: {
        hello(name) {
          return `hi ${name}`;
        },
      },
    });
    expect(builder.registry.get('node-comp')).toBe(data);
    expect(builder.registerWebComponent('x-y', { template: () => '' })).toBe(false);

    const script = await builder.export('node-comp', { type: 'script' });
    expect(() => new Function(script)).not.toThrow(); // parses

    const json = await builder.export('node-comp');
    const other = new ComponentBuilder();
    await expect(other.import(json)).resolves.toBe('node-comp');
  });
});
