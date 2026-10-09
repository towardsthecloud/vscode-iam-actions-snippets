import * as fs from 'node:fs/promises';

export interface IamActionData {
  action_name: string;
  description: string;
  access_level: string;
  url: string;
  resource_types: Array<{ name: string; reference_href: string }>;
  condition_keys: Array<{ name: string; reference_href: string }>;
}

export class IamActionMappings {
  private loading?: Promise<void>;
  private actions = new Map<string, IamActionData>();
  private services = new Map<string, IamActionData[]>();
  private lastError?: string;

  constructor(
    private readonly file: string,
    private readonly reportError: (message: string) => void,
  ) {}

  private async ensureDataLoaded(): Promise<void> {
    if (!this.loading)
      this.loading = this.load().catch((error) => {
        this.loading = undefined;
        const message = `Unable to load the IAM catalog: ${error instanceof Error ? error.message : String(error)}`;
        if (message !== this.lastError) this.reportError(message);
        this.lastError = message;
        throw error;
      });
    await this.loading;
  }

  private async load(): Promise<void> {
    const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
    const actions = new Map<string, IamActionData>();
    const services = new Map<string, IamActionData[]>();
    for (const service of Object.values(data) as Array<{
      service_prefix: string;
      actions: Record<string, IamActionData>;
    }>) {
      if (!/^[a-z0-9-]+$/.test(service.service_prefix) || services.has(service.service_prefix))
        throw new Error('Invalid service prefix');
      const entries = Object.values(service.actions);
      if (!entries.length) throw new Error('Empty service');
      for (const action of entries) {
        if (!action.action_name.startsWith(`${service.service_prefix}:`) || !action.description || !action.access_level)
          throw new Error('Invalid action metadata');
        for (const links of [action.resource_types, action.condition_keys]) {
          if (
            !Array.isArray(links) ||
            links.some((link) => typeof link.name !== 'string' || !this.documentationUrl(link.reference_href))
          )
            throw new Error('Invalid action links');
        }
        if (!this.documentationUrl(action.url) || actions.has(action.action_name.toLowerCase()))
          throw new Error('Invalid or duplicate action');
        actions.set(action.action_name.toLowerCase(), action);
      }
      services.set(service.service_prefix, entries);
    }
    if (!actions.size) throw new Error('Empty IAM catalog');
    this.actions = actions;
    this.services = services;
    this.lastError = undefined;
  }

  private documentationUrl(value: string): boolean {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'docs.aws.amazon.com';
  }

  public async getSuggestions(prefix: string): Promise<Array<string | IamActionData>> {
    await this.ensureDataLoaded();
    const query = prefix.toLowerCase();
    if (!query.includes(':'))
      return Array.from(this.services.keys())
        .filter((service) => service.startsWith(query))
        .map((service) => `${service}:`);
    return (this.services.get(query.split(':')[0]) || []).filter((action) =>
      action.action_name.toLowerCase().startsWith(query),
    );
  }

  public async getIamActionData(action: string): Promise<IamActionData | undefined> {
    await this.ensureDataLoaded();
    return this.actions.get(action.toLowerCase());
  }

  public async getMatchingActions(pattern: string): Promise<IamActionData[]> {
    await this.ensureDataLoaded();
    if (pattern === '*') return Array.from(this.actions.values());
    const [service, action] = pattern.toLowerCase().split(':');
    if (!action) return [];
    const expression = action
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${expression}$`, 'i');
    return (this.services.get(service) || []).filter((entry) => regex.test(entry.action_name.split(':')[1]));
  }
}
