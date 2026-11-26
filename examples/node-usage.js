const fs = require('fs');
const path = require('path');
const ComponentBuilder = require('../dist/component-builder.js');

async function main() {
  // Initialize the component builder. In Node there is no customElements
  // registry, so components are only defined and exported here, not rendered.
  const builder = new ComponentBuilder();

  console.log('🚀 Shared Component Builder - Node.js Example\n');

  // Define a component
  console.log('1. Defining a component...');
  builder.define('data-table', {
    version: '1.0.0',
    props: ['headers', 'data', 'sortable'],
    template: (props, state, { escape }) => {
      const headers = JSON.parse(props.headers || '[]');
      const data = JSON.parse(props.data || '[]');
            
      return `
                <table class="data-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${escape(header)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${row.map(cell => `<td>${escape(cell)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
    },
    styles: `
            .data-table {
                border-collapse: collapse;
                width: 100%;
                font-family: Arial, sans-serif;
            }
            .data-table th, .data-table td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            .data-table th {
                background-color: #f2f2f2;
                font-weight: bold;
            }
            .data-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
        `,
    methods: {
      sort(columnIndex) {
        const data = JSON.parse(this.props.data || '[]');
        data.sort((a, b) => {
          if (a[columnIndex] < b[columnIndex]) return -1;
          if (a[columnIndex] > b[columnIndex]) return 1;
          return 0;
        });
        this.setAttribute('data', JSON.stringify(data));
      }
    }
  });

  console.log('✅ Component defined successfully!\n');

  // Export the component as a script
  console.log('2. Exporting component as script...');
  try {
    const script = await builder.export('data-table', { type: 'script' });
    console.log('✅ Script generated successfully!');
    console.log('📄 Script length:', script.length, 'characters\n');
        
    // Save script to file (optional)
    const outFile = path.join(__dirname, 'data-table-component.js');
    fs.writeFileSync(outFile, script);
    console.log('💾 Script saved to:', outFile, '\n');
  } catch (error) {
    console.error('❌ Export error:', error.message);
  }

  // Export as JSON
  console.log('3. Exporting component as JSON...');
  try {
    const json = await builder.export('data-table', { type: 'json' });
    console.log('✅ JSON exported successfully!');
    console.log('📄 JSON structure:', Object.keys(json.data));
    console.log('📊 Component name:', json.data.name);
    console.log('📋 Component props:', json.data.props);
    console.log('📝 Usage instructions:', json.usage);
  } catch (error) {
    console.error('❌ JSON export error:', error.message);
  }

  // Example of importing a component
  console.log('\n4. Importing component example...');
  try {
    // Create a sample component data
    const sampleComponent = {
      name: 'sample-button',
      version: '1.0.0',
      props: ['text', 'color'],
      template:
        '(props, state, { escape }) => `<button style="background: ${escape(props.color)}">${escape(props.text)}</button>`',
      styles: 'button { padding: 10px; border: none; color: white; cursor: pointer; }',
      methods: {},
      events: [],
      created: Date.now()
    };

    const importedName = await builder.import(sampleComponent);
    console.log('✅ Component imported successfully:', importedName);
  } catch (error) {
    console.error('❌ Import error:', error.message);
  }

  // List all registered components
  console.log('\n5. Registered components:');
  console.log('📋 Registry size:', builder.registry.size);
  for (const [name, component] of builder.registry) {
    console.log(`   - ${name} (v${component.version})`);
  }

  console.log('\n🎉 Example completed successfully!');
}

// Run the example
main().catch(console.error); 