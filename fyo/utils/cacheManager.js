export default class CacheManager {
    constructor() {
        this._keyValueCache = new Map();
        this._hashCache = new Map();
    }
    // Regular Cache Ops
    getValue(key) {
        return this._keyValueCache.get(key);
    }
    setValue(key, value) {
        this._keyValueCache.set(key, value);
    }
    clearValue(key) {
        this._keyValueCache.delete(key);
    }
    // Hash Cache Ops
    hget(hashName, key) {
        const hc = this._hashCache.get(hashName);
        if (hc === undefined) {
            return hc;
        }
        return hc.get(key);
    }
    hset(hashName, key, value) {
        const hc = this._hashCache.get(hashName);
        if (hc === undefined) {
            this._hashCache.set(hashName, new Map());
        }
        this._hashCache.get(hashName).set(key, value);
    }
    hclear(hashName, key) {
        if (key) {
            this._hashCache.get(hashName)?.delete(key);
        }
        else {
            this._hashCache.get(hashName)?.clear();
        }
    }
    hexists(hashName) {
        return this._hashCache.get(hashName) !== undefined;
    }
}
//# sourceMappingURL=cacheManager.js.map