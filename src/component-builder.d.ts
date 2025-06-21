export interface ComponentDefinition {
  version?: string;
  props?: string[];
  template: (props: Record<string, any>, state: Record<string, any>) => string;
  styles?: string;
  methods?: Record<string, Function>;
  events?: string[];
  initialState?: Record<string, any>;
  mounted?: Function;
}

export interface ComponentBuilderOptions {
  apiEndpoint?: string;
  localRegistry?: boolean;
  [key: string]: any;
}

export interface ExportOptions {
  type?: 'script' | 'cloud' | 'json';
  [key: string]: any;
}

export interface ImportOptions {
  [key: string]: any;
}

export interface ComponentData {
  name: string;
  version: string;
  props: string[];
  template: string;
  styles: string;
  methods: Record<string, string>;
  events: string[];
  created: number;
  exportedAt?: number;
  exportOptions?: ExportOptions;
  [key: string]: any;
}

export default class ComponentBuilder {
  constructor(options?: ComponentBuilderOptions);
  
  registry: Map<string, ComponentData>;
  config: ComponentBuilderOptions;
  
  define(name: string, definition: ComponentDefinition): ComponentData;
  export(componentName: string, options?: ExportOptions): Promise<string | object>;
  import(source: string | ComponentData, options?: ImportOptions): Promise<string>;
  generateScript(componentData: ComponentData): string;
  registerWebComponent(name: string, definition: ComponentDefinition): void;
  serializeMethods(methods: Record<string, Function>): Record<string, string>;
  generateMethodsCode(methods: Record<string, string>): string;
  toPascalCase(str: string): string;
  generateUsageInstructions(componentName: string): string;
  saveToCloud(componentData: ComponentData): Promise<object>;
  loadFromCloud(componentName: string): Promise<ComponentData>;
  registerFromData(componentData: ComponentData, options?: ImportOptions): string;
} 