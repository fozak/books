var _DatabaseDemux_instances, _DatabaseDemux_isElectron, _DatabaseDemux_apiBaseUrl, _DatabaseDemux_handleDBCall;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { DatabaseError, NotImplemented } from 'fyo/utils/errors';
import { DatabaseDemuxBase } from 'utils/db/types'; // Removed DatabaseMethod import; using string instead
export class DatabaseDemux extends DatabaseDemuxBase {
    constructor(isElectron, apiBaseUrl) {
        super();
        _DatabaseDemux_instances.add(this);
        _DatabaseDemux_isElectron.set(this, false);
        _DatabaseDemux_apiBaseUrl.set(this, '');
        __classPrivateFieldSet(this, _DatabaseDemux_isElectron, isElectron, "f");
        if (isElectron) {
            __classPrivateFieldSet(this, _DatabaseDemux_apiBaseUrl, '', "f"); // no API URL needed in Electron
        }
        else {
            __classPrivateFieldSet(this, _DatabaseDemux_apiBaseUrl, apiBaseUrl || 'http://localhost:3001', "f"); // use passed URL or default
        }
    }
    async getSchemaMap() {
        if (__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            return (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                return await ipc.db.getSchema();
            }));
        }
        // Browser mode: fetch all tables, then schemas
        const tablesResp = (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
            const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/tables`);
            return await res.json();
        }));
        const tables = tablesResp.success ? tablesResp.data : [];
        const schemas = await Promise.all(tables.map(async (table) => {
            const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/schema/${encodeURIComponent(table)}`);
            const json = (await res.json());
            if (!json.success)
                throw new Error(`Failed to fetch schema for table ${table}`);
            return json.data;
        }));
        // Compose SchemaMap
        return schemas.reduce((acc, schema) => {
            acc[schema.tableName] = schema;
            return acc;
        }, {});
    }
    async createNewDatabase(dbPath, countryCode) {
        if (__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            return (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                return ipc.db.create(dbPath, countryCode);
            }));
        }
        throw new NotImplemented('Creating new database not supported in browser mode');
    }
    async connectToDatabase(dbPath, countryCode) {
        if (__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            return (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                return ipc.db.connect(dbPath, countryCode);
            }));
        }
        throw new NotImplemented('Connecting to database not supported in browser mode');
    }
    // Using `method: string` instead of DatabaseMethod for flexibility
    async call(method, ...args) {
        if (__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            return await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                return await ipc.db.call(method, ...args);
            });
        }
        // Browser mode: map method to API calls
        switch (method) {
            case 'getTables': {
                const resp = (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                    const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/tables`);
                    return await res.json();
                }));
                return resp.data;
            }
            case 'getSchema': {
                const tableName = args[0];
                const resp = (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                    const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/schema/${encodeURIComponent(tableName)}`);
                    return await res.json();
                }));
                return resp.data;
            }
            case 'getTableData': {
                const tableName = args[0];
                const options = args[1];
                const params = new URLSearchParams();
                if (options?.limit)
                    params.append('limit', options.limit.toString());
                if (options?.offset)
                    params.append('offset', options.offset.toString());
                if (options?.orderBy)
                    params.append('orderBy', options.orderBy);
                if (options?.order)
                    params.append('order', options.order);
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/data/${encodeURIComponent(tableName)}?${params.toString()}`);
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to get data for ${tableName}`);
                return json.data;
            }
            case 'getRecord': {
                const tableName = args[0];
                const id = args[1];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`);
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to get record ${id} from ${tableName}`);
                return json.data;
            }
            case 'searchRecords': {
                const tableName = args[0];
                const q = args[1];
                const field = args[2] || 'name';
                const limit = args[3] || 50;
                const params = new URLSearchParams({ q, field, limit: limit.toString() });
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/search/${encodeURIComponent(tableName)}?${params.toString()}`);
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to search in ${tableName}`);
                return json.data.records;
            }
            case 'insertRecord': {
                const tableName = args[0];
                const data = args[1];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/data/${encodeURIComponent(tableName)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to insert record into ${tableName}`);
                return json.data;
            }
            case 'updateRecord': {
                const tableName = args[0];
                const id = args[1];
                const data = args[2];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to update record ${id} in ${tableName}`);
                return json.data;
            }
            case 'deleteRecord': {
                const tableName = args[0];
                const id = args[1];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`, {
                    method: 'DELETE',
                });
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to delete record ${id} from ${tableName}`);
                return json.data;
            }
            case 'runQuery': {
                const sql = args[0];
                const params = args[1] || [];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql, params }),
                });
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to run query`);
                return json.data;
            }
            case 'getMetadata': {
                const tableName = args[0];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/meta/${encodeURIComponent(tableName)}`);
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to get metadata for ${tableName}`);
                return json.data;
            }
            case 'getSingleDoc': {
                const parent = args[0];
                const res = await fetch(`${__classPrivateFieldGet(this, _DatabaseDemux_apiBaseUrl, "f")}/api/single/${encodeURIComponent(parent)}`);
                const json = (await res.json());
                if (!json.success)
                    throw new Error(`Failed to get single doc ${parent}`);
                return json.data;
            }
            default:
                throw new NotImplemented(`Method ${method} is not implemented in browser mode`);
        }
    }
    async callBespoke(method, ...args) {
        if (__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            return await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
                return await ipc.db.bespoke(method, ...args);
            });
        }
        throw new NotImplemented(`Bespoke method ${method} is not implemented in browser mode`);
    }
}
_DatabaseDemux_isElectron = new WeakMap(), _DatabaseDemux_apiBaseUrl = new WeakMap(), _DatabaseDemux_instances = new WeakSet(), _DatabaseDemux_handleDBCall = async function _DatabaseDemux_handleDBCall(func) {
    const response = await func();
    if (!__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
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
};
//# sourceMappingURL=db.js.map