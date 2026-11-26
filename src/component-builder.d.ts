export interface TemplateHelpers {
  /** Escape a value for safe interpolation into HTML. */
  escape(value: unknown): string;
}

/** The element instance that templates, methods and `mounted` run against. */
export interface ComponentInstance extends HTMLElement {
  props: Record<string, string>;
  state: Record<string, any>;
  render(): void;
  setState(partial: Record<string, any>): void;
  /** Dispatch a bubbling, composed CustomEvent from the element. */
  emit(name: string, detail?: unknown): boolean;
  [method: string]: any;
}

export interface ComponentDefinition {
  version?: string;
  /** Observed attributes, exposed to the template as `props`. */
  props?: string[];
  /**
   * Must be self-contained (no references to outer variables) to survive
   * export/import, because it is shared as source text.
   */
  template: (
    this: ComponentInstance,
    props: Record<string, string>,
    state: Record<string, any>,
    helpers: TemplateHelpers
  ) => string;
  styles?: string;
  /**
   * Called as `this.method(event, element)` from `on-<event>="method"`
   * attributes in the template. Use regular functions, not arrows.
   */
  methods?: Record<string, (this: ComponentInstance, ...args: any[]) => any>;
  events?: string[];
  /** Must be JSON-serializable; each instance receives its own copy. */
  initialState?: Record<string, any>;
  mounted?: (this: ComponentInstance) => void;
  [metadata: string]: any;
}

export interface ComponentBuilderOptions {
  apiEndpoint?: string | null;
  [key: string]: any;
}

export interface ExportOptions {
  type?: 'script' | 'cloud' | 'json';
  [key: string]: any;
}

export interface ImportOptions {
  /** Register the component under a different name. */
  name?: string;
}

export interface ComponentData {
  name: string;
  version: string;
  props: string[];
  template: string;
  styles: string;
  methods: Record<string, string>;
  events: string[];
  initialState: Record<string, any>;
  mounted: string | null;
  created: number;
  exportedAt?: number;
  exportOptions?: ExportOptions;
  [key: string]: any;
}

export interface JsonExport {
  type: 'json';
  data: ComponentData;
  usage: string;
}

export default class ComponentBuilder {
  constructor(options?: ComponentBuilderOptions);

  static escapeHtml(value: unknown): string;

  registry: Map<string, ComponentData>;
  config: ComponentBuilderOptions;

  define(name: string, definition: ComponentDefinition): ComponentData;
  export(componentName: string, options: ExportOptions & { type: 'script' }): Promise<string>;
  export(componentName: string, options: ExportOptions & { type: 'cloud' }): Promise<any>;
  export(componentName: string, options?: ExportOptions): Promise<JsonExport>;
  import(
    source: string | ComponentData | JsonExport,
    options?: ImportOptions
  ): Promise<string>;
  generateScript(componentData: ComponentData): string;
  registerWebComponent(name: string, definition: ComponentDefinition): boolean;
  serializeMethods(methods: Record<string, Function>): Record<string, string>;
  generateMethodsCode(methods: Record<string, string>): string;
  toPascalCase(str: string): string;
  generateUsageInstructions(componentName: string): string;
  fetchJson(url: string, init?: RequestInit): Promise<any>;
  saveToCloud(componentData: ComponentData): Promise<any>;
  loadFromCloud(componentName: string): Promise<ComponentData>;
  registerFromData(componentData: ComponentData, options?: ImportOptions): string;
}
