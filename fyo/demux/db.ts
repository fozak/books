import { DatabaseError, NotImplemented } from 'fyo/utils/errors';
import { SchemaMap } from 'schemas/types';
import { DatabaseDemuxBase } from 'utils/db/types'; // Removed DatabaseMethod import; using string instead
import { BackendResponse } from 'utils/ipc/types';

// Declare ipc if not imported from anywhere — replace `any` with your ipc type if known
declare const ipc: any;

export class DatabaseDemux extends DatabaseDemuxBase {
  #isElectron = false;
  #apiBaseUrl = '';

  constructor(isElectron: boolean, apiBaseUrl?: string) {
    super();
    this.#isElectron = isElectron;
    if (isElectron) {
      this.#apiBaseUrl = ''; // no API URL needed in Electron
    } else {
      this.#apiBaseUrl = apiBaseUrl || 'http://localhost:3001'; // use passed URL or default
    }
  }

  async #handleDBCall(func: () => Promise<BackendResponse | any>): Promise<unknown> {
    const response = await func();

    if (!this.#isElectron) {
      // In browser mode, response might be the direct data or error object
      if (response?.error) {
        const err = response.error;
        const dberror = new DatabaseError(`${err.name || 'Error'}\n${err.message || 'Unknown error'}`);
        dberror.stack = err.stack;
        throw dberror;
      }
      return response.data ?? response;
    }

    // Electron mode expects BackendResponse
    if (response.error?.name) {
      const { name, message, stack } = response.error;
      const dberror = new DatabaseError(`${name}\n${message}`);
      dberror.stack = stack;
      throw dberror;
    }

    return response.data;
  }

  async getSchemaMap(): Promise<SchemaMap> {
    if (this.#isElectron) {
      return (await this.#handleDBCall(async () => {
        return await ipc.db.getSchema();
      })) as SchemaMap;
    }

    // Browser mode: fetch all tables, then schemas
    const tablesResp = (await this.#handleDBCall(async () => {
      const res = await fetch(`${this.#apiBaseUrl}/api/tables`);
      return await res.json();
    })) as { success: boolean; data: string[] };

    const tables = tablesResp.success ? tablesResp.data : [];
    const schemas = await Promise.all(
      tables.map(async (table: string) => {
        const res = await fetch(`${this.#apiBaseUrl}/api/schema/${encodeURIComponent(table)}`);
        const json = (await res.json()) as { success: boolean; data: any };
        if (!json.success) throw new Error(`Failed to fetch schema for table ${table}`);
        return json.data;
      })
    );

    // Compose SchemaMap
    return schemas.reduce((acc: any, schema: any) => {
      acc[schema.tableName] = schema;
      return acc;
    }, {} as SchemaMap);
  }

  async createNewDatabase(dbPath: string, countryCode?: string): Promise<string> {
    if (this.#isElectron) {
      return (await this.#handleDBCall(async () => {
        return ipc.db.create(dbPath, countryCode);
      })) as string;
    }
    throw new NotImplemented('Creating new database not supported in browser mode');
  }

  async connectToDatabase(dbPath: string, countryCode?: string): Promise<string> {
    if (this.#isElectron) {
      return (await this.#handleDBCall(async () => {
        return ipc.db.connect(dbPath, countryCode);
      })) as string;
    }
    throw new NotImplemented('Connecting to database not supported in browser mode');
  }

  // Using `method: string` instead of DatabaseMethod for flexibility
  async call(method: string, ...args: unknown[]): Promise<unknown> {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return await ipc.db.call(method, ...args);
      });
    }

    // Browser mode: map method to API calls
    switch (method) {
      case 'getTables': {
        const resp = (await this.#handleDBCall(async () => {
          const res = await fetch(`${this.#apiBaseUrl}/api/tables`);
          return await res.json();
        })) as { success: boolean; data: unknown };
        return resp;  // <-- just return resp (which is already resp.data)
      }

      case 'getSchema': {
        const tableName = args[0] as string;
        const resp = (await this.#handleDBCall(async () => {
          const res = await fetch(`${this.#apiBaseUrl}/api/schema/${encodeURIComponent(tableName)}`);
          return await res.json();
        })) as { success: boolean; data: unknown };
        return resp;  // <-- just return resp (which is already resp.data)
      }

case 'getTableData': {
  const tableName = args[0] as string;
  const options = args[1] as { limit?: number; offset?: number; orderBy?: string; order?: string } | undefined;
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.orderBy) params.append('orderBy', options.orderBy);
  if (options?.order) params.append('order', options.order);

  const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}?${params.toString()}`);
  const json = (await res.json()) as { success: boolean; data: any };
  if (!json.success) throw new Error(`Failed to get data for ${tableName}`);

  return json.data.records; // ✅ ONLY return the array of records
}

      case 'getRecord': {
        const tableName = args[0] as string;
        const id = args[1] as string | number;
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`);
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to get record ${id} from ${tableName}`);
        return json.data;
      }

      case 'searchRecords': {
        const tableName = args[0] as string;
        const q = args[1] as string;
        const field = (args[2] as string) || 'name';
        const limit = (args[3] as number) || 50;
        const params = new URLSearchParams({ q, field, limit: limit.toString() });

        const res = await fetch(`${this.#apiBaseUrl}/api/search/${encodeURIComponent(tableName)}?${params.toString()}`);
        const json = await res.json();

        if (!json || typeof json !== 'object') {
          throw new Error(`Invalid response for search in ${tableName}`);
        }

        if (!json.success) {
          throw new Error(`Failed to search in ${tableName}`);
        }

        if (!json.data || !Array.isArray(json.data.records)) {
          throw new Error(`Malformed data received for ${tableName} search`);
        }

        return json.data.records;
      }


      case 'insertRecord': {
        const tableName = args[0] as string;
        const data = args[1] as object;
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to insert record into ${tableName}`);
        return json.data;
      }

      case 'updateRecord': {
        const tableName = args[0] as string;
        const id = args[1] as string | number;
        const data = args[2] as object;
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to update record ${id} in ${tableName}`);
        return json.data;
      }

      case 'deleteRecord': {
        const tableName = args[0] as string;
        const id = args[1] as string | number;
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`, {
          method: 'DELETE',
        });
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to delete record ${id} from ${tableName}`);
        return json.data;
      }

      case 'runQuery': {
        const sql = args[0] as string;
        const params = (args[1] as unknown[]) || [];
        const res = await fetch(`${this.#apiBaseUrl}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params }),
        });
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to run query`);
        return json.data;
      }

      case 'getMetadata': {
        const tableName = args[0] as string;
        const res = await fetch(`${this.#apiBaseUrl}/api/meta/${encodeURIComponent(tableName)}`);
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to get metadata for ${tableName}`);
        return json.data;
      }

      case 'getSingleDoc': {
        const parent = args[0] as string;
        const res = await fetch(`${this.#apiBaseUrl}/api/single/${encodeURIComponent(parent)}`);
        const json = (await res.json()) as { success: boolean; data: unknown };
        if (!json.success) throw new Error(`Failed to get single doc ${parent}`);
        return json.data;
      }

      default:
        throw new NotImplemented(`Method ${method} is not implemented in browser mode`);
    }
  }

  async callBespoke(method: string, ...args: unknown[]): Promise<unknown> {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return await ipc.db.bespoke(method, ...args);
      });
    }
    throw new NotImplemented(`Bespoke method ${method} is not implemented in browser mode`);
  }
}

