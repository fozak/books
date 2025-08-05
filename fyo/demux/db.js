var _DatabaseDemux_instances, _DatabaseDemux_isElectron, _DatabaseDemux_handleDBCall;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { DatabaseError, NotImplemented } from 'fyo/utils/errors';
import { DatabaseDemuxBase } from 'utils/db/types';
export class DatabaseDemux extends DatabaseDemuxBase {
    constructor(isElectron) {
        super();
        _DatabaseDemux_instances.add(this);
        _DatabaseDemux_isElectron.set(this, false);
        __classPrivateFieldSet(this, _DatabaseDemux_isElectron, isElectron, "f");
    }
    async getSchemaMap() {
        if (!__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            throw new NotImplemented();
        }
        return (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
            return await ipc.db.getSchema();
        }));
    }
    async createNewDatabase(dbPath, countryCode) {
        if (!__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            throw new NotImplemented();
        }
        return (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
            return ipc.db.create(dbPath, countryCode);
        }));
    }
    async connectToDatabase(dbPath, countryCode) {
        if (!__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            throw new NotImplemented();
        }
        return (await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
            return ipc.db.connect(dbPath, countryCode);
        }));
    }
    async call(method, ...args) {
        if (!__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            throw new NotImplemented();
        }
        return await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
            return await ipc.db.call(method, ...args);
        });
    }
    async callBespoke(method, ...args) {
        if (!__classPrivateFieldGet(this, _DatabaseDemux_isElectron, "f")) {
            throw new NotImplemented();
        }
        return await __classPrivateFieldGet(this, _DatabaseDemux_instances, "m", _DatabaseDemux_handleDBCall).call(this, async () => {
            return await ipc.db.bespoke(method, ...args);
        });
    }
}
_DatabaseDemux_isElectron = new WeakMap(), _DatabaseDemux_instances = new WeakSet(), _DatabaseDemux_handleDBCall = async function _DatabaseDemux_handleDBCall(func) {
    const response = await func();
    if (response.error?.name) {
        const { name, message, stack } = response.error;
        const dberror = new DatabaseError(`${name}\n${message}`);
        dberror.stack = stack;
        throw dberror;
    }
    return response.data;
};
//# sourceMappingURL=db.js.map