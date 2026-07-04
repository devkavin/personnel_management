import type { Pool, PoolConnection } from "mysql2/promise";

export type DatabaseExecutor = Pick<Pool | PoolConnection, "query">;

export interface SystemSettingDefinition {
  key: string;
  apiKey: string;
  name: string;
  scope: "system" | "tenant";
  type: "select" | "boolean";
  defaultValue: string;
  options?: string[];
}

export interface SystemCapability {
  code: string;
  globalSettings?: SystemSettingDefinition[];
  tenantSettings?: SystemSettingDefinition[];
  dashboardStats?: (database: DatabaseExecutor) => Promise<Record<string, unknown>>;
  onTenantEnabled?: (database: DatabaseExecutor, tenantId: number, userId: number) => Promise<void>;
}

export class SystemRegistry {
  private readonly capabilities = new Map<string, SystemCapability>();

  constructor(capabilities: SystemCapability[]) {
    for (const capability of capabilities) {
      if (this.capabilities.has(capability.code)) throw new Error(`Duplicate system capability: ${capability.code}`);
      this.capabilities.set(capability.code, capability);
    }
  }

  get(code: string) {
    return this.capabilities.get(code);
  }

  list() {
    return [...this.capabilities.values()].sort((left, right) => left.code.localeCompare(right.code));
  }
}
