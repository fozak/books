// fyo/utils/errors.ts
var BaseError = class extends Error {
  constructor(statusCode, message, shouldStore = true) {
    super(message);
    this.more = {};
    this.name = "BaseError";
    this.statusCode = statusCode;
    this.message = message;
    this.shouldStore = shouldStore;
  }
};
var DatabaseError = class extends BaseError {
  constructor(message, shouldStore = true) {
    super(500, message, shouldStore);
    this.name = "DatabaseError";
  }
};
var NotImplemented = class extends BaseError {
  constructor(message = "", shouldStore = false) {
    super(501, message, shouldStore);
    this.name = "NotImplemented";
  }
};

// utils/db/types.ts
var DatabaseDemuxBase = class {
};

// fyo/demux/db.ts
var DatabaseDemux = class extends DatabaseDemuxBase {
  #isElectron = false;
  #apiBaseUrl = "";
  constructor(isElectron, apiBaseUrl) {
    super();
    this.#isElectron = isElectron;
    if (isElectron) {
      this.#apiBaseUrl = "";
    } else {
      this.#apiBaseUrl = apiBaseUrl || "http://localhost:3001";
    }
  }
  async #handleDBCall(func) {
    const response = await func();
    if (!this.#isElectron) {
      if (response?.error) {
        const err = response.error;
        const dberror = new DatabaseError(`${err.name || "Error"}
${err.message || "Unknown error"}`);
        dberror.stack = err.stack;
        throw dberror;
      }
      return response.data ?? response;
    }
    if (response.error?.name) {
      const { name, message, stack } = response.error;
      const dberror = new DatabaseError(`${name}
${message}`);
      dberror.stack = stack;
      throw dberror;
    }
    return response.data;
  }
  async getSchemaMap() {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return await ipc.db.getSchema();
      });
    }
    const tablesResp = await this.#handleDBCall(async () => {
      const res = await fetch(`${this.#apiBaseUrl}/api/tables`);
      return await res.json();
    });
    const tables = tablesResp.success ? tablesResp.data : [];
    const schemas = await Promise.all(
      tables.map(async (table) => {
        const res = await fetch(`${this.#apiBaseUrl}/api/schema/${encodeURIComponent(table)}`);
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to fetch schema for table ${table}`);
        return json.data;
      })
    );
    return schemas.reduce((acc, schema) => {
      acc[schema.tableName] = schema;
      return acc;
    }, {});
  }
  async createNewDatabase(dbPath, countryCode) {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return ipc.db.create(dbPath, countryCode);
      });
    }
    throw new NotImplemented("Creating new database not supported in browser mode");
  }
  async connectToDatabase(dbPath, countryCode) {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return ipc.db.connect(dbPath, countryCode);
      });
    }
    throw new NotImplemented("Connecting to database not supported in browser mode");
  }
  // Using `method: string` instead of DatabaseMethod for flexibility
  async call(method, ...args) {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return await ipc.db.call(method, ...args);
      });
    }
    switch (method) {
      case "getTables": {
        const resp = await this.#handleDBCall(async () => {
          const res = await fetch(`${this.#apiBaseUrl}/api/tables`);
          return await res.json();
        });
        return resp;
      }
      case "getSchema": {
        const tableName = args[0];
        const resp = await this.#handleDBCall(async () => {
          const res = await fetch(`${this.#apiBaseUrl}/api/schema/${encodeURIComponent(tableName)}`);
          return await res.json();
        });
        return resp;
      }
      case "getTableData": {
        const tableName = args[0];
        const options = args[1];
        const params = new URLSearchParams();
        if (options?.limit)
          params.append("limit", options.limit.toString());
        if (options?.offset)
          params.append("offset", options.offset.toString());
        if (options?.orderBy)
          params.append("orderBy", options.orderBy);
        if (options?.order)
          params.append("order", options.order);
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}?${params.toString()}`);
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to get data for ${tableName}`);
        return json;
      }
      case "getRecord": {
        const tableName = args[0];
        const id = args[1];
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`);
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to get record ${id} from ${tableName}`);
        return json;
      }
      case "searchRecords": {
        const tableName = args[0];
        const q = args[1];
        const field = args[2] || "name";
        const limit = args[3] || 50;
        const params = new URLSearchParams({ q, field, limit: limit.toString() });
        const res = await fetch(`${this.#apiBaseUrl}/api/search/${encodeURIComponent(tableName)}?${params.toString()}`);
        const json = await res.json();
        if (!json || typeof json !== "object") {
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
      case "insertRecord": {
        const tableName = args[0];
        const data = args[1];
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to insert record into ${tableName}`);
        return json;
      }
      case "updateRecord": {
        const tableName = args[0];
        const id = args[1];
        const data = args[2];
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to update record ${id} in ${tableName}`);
        return json;
      }
      case "deleteRecord": {
        const tableName = args[0];
        const id = args[1];
        const res = await fetch(`${this.#apiBaseUrl}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`, {
          method: "DELETE"
        });
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to delete record ${id} from ${tableName}`);
        return json;
      }
      case "runQuery": {
        const sql = args[0];
        const params = args[1] || [];
        const res = await fetch(`${this.#apiBaseUrl}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql, params })
        });
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to run query`);
        return json;
      }
      case "getMetadata": {
        const tableName = args[0];
        const res = await fetch(`${this.#apiBaseUrl}/api/meta/${encodeURIComponent(tableName)}`);
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to get metadata for ${tableName}`);
        return json;
      }
      case "getSingleDoc": {
        const parent = args[0];
        const res = await fetch(`${this.#apiBaseUrl}/api/single/${encodeURIComponent(parent)}`);
        const json = await res.json();
        if (!json.success)
          throw new Error(`Failed to get single doc ${parent}`);
        return json;
      }
      default:
        throw new NotImplemented(`Method ${method} is not implemented in browser mode`);
    }
  }
  async callBespoke(method, ...args) {
    if (this.#isElectron) {
      return await this.#handleDBCall(async () => {
        return await ipc.db.bespoke(method, ...args);
      });
    }
    throw new NotImplemented(`Bespoke method ${method} is not implemented in browser mode`);
  }
};
export {
  DatabaseDemux
};
