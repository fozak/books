var _DocHandler_instances, _DocHandler_temporaryNameCounters, _DocHandler_addToCache, _DocHandler_setCacheUpdationListeners, _DocHandler_getFromCache, _DocHandler_cacheHas;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { Doc } from 'fyo/model/doc';
import { coreModels } from 'fyo/models';
import { NotFoundError, ValueError } from 'fyo/utils/errors';
import Observable from 'fyo/utils/observable';
import { getRandomString } from 'utils';
export class DocHandler {
    constructor(fyo) {
        _DocHandler_instances.add(this);
        this.models = {};
        this.singles = {};
        this.docs = new Observable();
        this.observer = new Observable();
        _DocHandler_temporaryNameCounters.set(this, void 0);
        this.fyo = fyo;
        __classPrivateFieldSet(this, _DocHandler_temporaryNameCounters, {}, "f");
    }
    init() {
        this.models = {};
        this.singles = {};
        this.docs = new Observable();
        this.observer = new Observable();
    }
    purgeCache() {
        this.init();
    }
    registerModels(models, regionalModels = {}) {
        for (const schemaName in this.fyo.db.schemaMap) {
            if (coreModels[schemaName] !== undefined) {
                this.models[schemaName] = coreModels[schemaName];
            }
            else if (regionalModels[schemaName] !== undefined) {
                this.models[schemaName] = regionalModels[schemaName];
            }
            else if (models[schemaName] !== undefined) {
                this.models[schemaName] = models[schemaName];
            }
            else {
                this.models[schemaName] = Doc;
            }
        }
    }
    /**
     * Doc Operations
     */
    async getDoc(schemaName, name, options = { skipDocumentCache: false }) {
        if (name === undefined) {
            name = schemaName;
        }
        if (name === schemaName && !this.fyo.schemaMap[schemaName]?.isSingle) {
            throw new ValueError(`${schemaName} is not a Single Schema`);
        }
        let doc;
        if (!options?.skipDocumentCache) {
            doc = __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_getFromCache).call(this, schemaName, name);
        }
        if (doc) {
            return doc;
        }
        doc = this.getNewDoc(schemaName, { name }, false);
        await doc.load();
        __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_addToCache).call(this, doc);
        return doc;
    }
    getNewDoc(schemaName, data = {}, cacheDoc = true, schema, Model, isRawValueMap = true) {
        if (!this.models[schemaName] && Model) {
            this.models[schemaName] = Model;
        }
        Model ?? (Model = this.models[schemaName]);
        schema ?? (schema = this.fyo.schemaMap[schemaName]);
        if (schema === undefined) {
            throw new NotFoundError(`Schema not found for ${schemaName}`);
        }
        const doc = new Model(schema, data, this.fyo, isRawValueMap);
        doc.name ?? (doc.name = this.getTemporaryName(schema));
        if (cacheDoc) {
            __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_addToCache).call(this, doc);
        }
        return doc;
    }
    isTemporaryName(name, schema) {
        const label = schema.label ?? schema.name;
        const template = this.fyo.t `New ${label} `;
        return name.includes(template);
    }
    getTemporaryName(schema) {
        var _a, _b;
        if (schema.naming === 'random') {
            return getRandomString();
        }
        (_a = __classPrivateFieldGet(this, _DocHandler_temporaryNameCounters, "f"))[_b = schema.name] ?? (_a[_b] = 1);
        const idx = __classPrivateFieldGet(this, _DocHandler_temporaryNameCounters, "f")[schema.name];
        __classPrivateFieldGet(this, _DocHandler_temporaryNameCounters, "f")[schema.name] = idx + 1;
        const label = schema.label ?? schema.name;
        return this.fyo.t `New ${label} ${String(idx).padStart(2, '0')}`;
    }
    removeFromCache(schemaName, name) {
        const docMap = this.docs.get(schemaName);
        delete docMap?.[name];
    }
}
_DocHandler_temporaryNameCounters = new WeakMap(), _DocHandler_instances = new WeakSet(), _DocHandler_addToCache = function _DocHandler_addToCache(doc) {
    if (!doc.name) {
        return;
    }
    const name = doc.name;
    const schemaName = doc.schemaName;
    if (!this.docs[schemaName]) {
        this.docs.set(schemaName, {});
        __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_setCacheUpdationListeners).call(this, schemaName);
    }
    this.docs.get(schemaName)[name] = doc;
    // singles available as first level objects too
    if (schemaName === doc.name) {
        this.singles[name] = doc;
    }
    // propagate change to `docs`
    doc.on('change', (params) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.docs.trigger('change', params);
    });
    doc.on('afterSync', () => {
        if (doc.name === name && __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_cacheHas).call(this, schemaName, name)) {
            return;
        }
        this.removeFromCache(doc.schemaName, name);
        __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_addToCache).call(this, doc);
    });
}, _DocHandler_setCacheUpdationListeners = function _DocHandler_setCacheUpdationListeners(schemaName) {
    this.fyo.db.observer.on(`delete:${schemaName}`, (name) => {
        if (typeof name !== 'string') {
            return;
        }
        this.removeFromCache(schemaName, name);
    });
    this.fyo.db.observer.on(`rename:${schemaName}`, (names) => {
        const { oldName } = names;
        const doc = __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_getFromCache).call(this, schemaName, oldName);
        if (doc === undefined) {
            return;
        }
        this.removeFromCache(schemaName, oldName);
        __classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_addToCache).call(this, doc);
    });
}, _DocHandler_getFromCache = function _DocHandler_getFromCache(schemaName, name) {
    const docMap = this.docs.get(schemaName);
    return docMap?.[name];
}, _DocHandler_cacheHas = function _DocHandler_cacheHas(schemaName, name) {
    return !!__classPrivateFieldGet(this, _DocHandler_instances, "m", _DocHandler_getFromCache).call(this, schemaName, name);
};
//# sourceMappingURL=docHandler.js.map