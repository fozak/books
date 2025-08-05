var _DatabaseHandler_instances, _DatabaseHandler_fyo, _DatabaseHandler_demux, _DatabaseHandler_schemaMap, _DatabaseHandler_fieldMap, _DatabaseHandler_getAll, _DatabaseHandler_setFieldMap;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { DatabaseDemux } from 'fyo/demux/db';
import { ValueError } from 'fyo/utils/errors';
import Observable from 'fyo/utils/observable';
import { translateSchema } from 'fyo/utils/translation';
import { getMapFromList } from 'utils';
import { DatabaseBase, } from 'utils/db/types';
import { schemaTranslateables } from 'utils/translationHelpers';
import { Converter } from './converter';
export class DatabaseHandler extends DatabaseBase {
    constructor(fyo, Demux) {
        super();
        _DatabaseHandler_instances.add(this);
        /* eslint-disable @typescript-eslint/no-floating-promises */
        _DatabaseHandler_fyo.set(this, void 0);
        _DatabaseHandler_demux.set(this, void 0);
        _DatabaseHandler_schemaMap.set(this, {});
        _DatabaseHandler_fieldMap.set(this, {});
        this.observer = new Observable();
        __classPrivateFieldSet(this, _DatabaseHandler_fyo, fyo, "f");
        this.converter = new Converter(this, __classPrivateFieldGet(this, _DatabaseHandler_fyo, "f"));
        if (Demux !== undefined) {
            __classPrivateFieldSet(this, _DatabaseHandler_demux, new Demux(fyo.isElectron), "f");
        }
        else {
            __classPrivateFieldSet(this, _DatabaseHandler_demux, new DatabaseDemux(fyo.isElectron), "f");
        }
    }
    get schemaMap() {
        return __classPrivateFieldGet(this, _DatabaseHandler_schemaMap, "f");
    }
    get fieldMap() {
        return __classPrivateFieldGet(this, _DatabaseHandler_fieldMap, "f");
    }
    get isConnected() {
        return !!this.dbPath;
    }
    async createNewDatabase(dbPath, countryCode) {
        countryCode = await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").createNewDatabase(dbPath, countryCode);
        await this.init();
        this.dbPath = dbPath;
        return countryCode;
    }
    async connectToDatabase(dbPath, countryCode) {
        countryCode = await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").connectToDatabase(dbPath, countryCode);
        await this.init();
        this.dbPath = dbPath;
        return countryCode;
    }
    async init() {
        __classPrivateFieldSet(this, _DatabaseHandler_schemaMap, await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").getSchemaMap(), "f");
        __classPrivateFieldGet(this, _DatabaseHandler_instances, "m", _DatabaseHandler_setFieldMap).call(this);
        this.observer = new Observable();
    }
    async translateSchemaMap(languageMap) {
        if (languageMap) {
            translateSchema(__classPrivateFieldGet(this, _DatabaseHandler_schemaMap, "f"), languageMap, schemaTranslateables);
        }
        else {
            __classPrivateFieldSet(this, _DatabaseHandler_schemaMap, await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").getSchemaMap(), "f");
            __classPrivateFieldGet(this, _DatabaseHandler_instances, "m", _DatabaseHandler_setFieldMap).call(this);
        }
    }
    async purgeCache() {
        await this.close();
        this.dbPath = undefined;
        __classPrivateFieldSet(this, _DatabaseHandler_schemaMap, {}, "f");
        __classPrivateFieldSet(this, _DatabaseHandler_fieldMap, {}, "f");
    }
    async insert(schemaName, docValueMap) {
        let rawValueMap = this.converter.toRawValueMap(schemaName, docValueMap);
        rawValueMap = (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('insert', schemaName, rawValueMap));
        this.observer.trigger(`insert:${schemaName}`, docValueMap);
        return this.converter.toDocValueMap(schemaName, rawValueMap);
    }
    // Read
    async get(schemaName, name, fields) {
        const rawValueMap = (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('get', schemaName, name, fields));
        this.observer.trigger(`get:${schemaName}`, { name, fields });
        return this.converter.toDocValueMap(schemaName, rawValueMap);
    }
    async getAll(schemaName, options = {}) {
        const rawValueMap = await __classPrivateFieldGet(this, _DatabaseHandler_instances, "m", _DatabaseHandler_getAll).call(this, schemaName, options);
        this.observer.trigger(`getAll:${schemaName}`, options);
        return this.converter.toDocValueMap(schemaName, rawValueMap);
    }
    async getAllRaw(schemaName, options = {}) {
        const all = await __classPrivateFieldGet(this, _DatabaseHandler_instances, "m", _DatabaseHandler_getAll).call(this, schemaName, options);
        this.observer.trigger(`getAllRaw:${schemaName}`, options);
        return all;
    }
    async getSingleValues(...fieldnames) {
        const rawSingleValue = (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('getSingleValues', ...fieldnames));
        const docSingleValue = [];
        for (const sv of rawSingleValue) {
            const field = this.fieldMap[sv.parent][sv.fieldname];
            const value = Converter.toDocValue(sv.value, field, __classPrivateFieldGet(this, _DatabaseHandler_fyo, "f"));
            docSingleValue.push({
                value,
                parent: sv.parent,
                fieldname: sv.fieldname,
            });
        }
        this.observer.trigger(`getSingleValues`, fieldnames);
        return docSingleValue;
    }
    async count(schemaName, options = {}) {
        const rawValueMap = await __classPrivateFieldGet(this, _DatabaseHandler_instances, "m", _DatabaseHandler_getAll).call(this, schemaName, options);
        const count = rawValueMap.length;
        this.observer.trigger(`count:${schemaName}`, options);
        return count;
    }
    // Update
    async rename(schemaName, oldName, newName) {
        await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('rename', schemaName, oldName, newName);
        this.observer.trigger(`rename:${schemaName}`, { oldName, newName });
    }
    async update(schemaName, docValueMap) {
        const rawValueMap = this.converter.toRawValueMap(schemaName, docValueMap);
        await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('update', schemaName, rawValueMap);
        this.observer.trigger(`update:${schemaName}`, docValueMap);
    }
    // Delete
    async delete(schemaName, name) {
        await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('delete', schemaName, name);
        this.observer.trigger(`delete:${schemaName}`, name);
    }
    async deleteAll(schemaName, filters) {
        const count = (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('deleteAll', schemaName, filters));
        this.observer.trigger(`deleteAll:${schemaName}`, filters);
        return count;
    }
    // Other
    async exists(schemaName, name) {
        const doesExist = (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('exists', schemaName, name));
        this.observer.trigger(`exists:${schemaName}`, name);
        return doesExist;
    }
    async close() {
        await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('close');
    }
    /**
     * Bespoke function
     *
     * These are functions to run custom queries that are too complex for
     * DatabaseCore and require use of knex or raw queries. The output
     * of these is not converted to DocValue and is used as is (RawValue).
     *
     * The query logic for these is in backend/database/bespoke.ts
     */
    async getLastInserted(schemaName) {
        if (this.schemaMap[schemaName]?.naming !== 'autoincrement') {
            throw new ValueError(`invalid schema, ${schemaName} does not have autoincrement naming`);
        }
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getLastInserted', schemaName));
    }
    async getTopExpenses(fromDate, toDate) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getTopExpenses', fromDate, toDate));
    }
    async getTotalOutstanding(schemaName, fromDate, toDate) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getTotalOutstanding', schemaName, fromDate, toDate));
    }
    async getCashflow(fromDate, toDate) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getCashflow', fromDate, toDate));
    }
    async getIncomeAndExpenses(fromDate, toDate) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getIncomeAndExpenses', fromDate, toDate));
    }
    async getTotalCreditAndDebit() {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getTotalCreditAndDebit'));
    }
    async getStockQuantity(item, location, fromDate, toDate, batch, serialNumbers) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getStockQuantity', item, location, fromDate, toDate, batch, serialNumbers));
    }
    async getReturnBalanceItemsQty(schemaName, docName) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getReturnBalanceItemsQty', schemaName, docName));
    }
    async getPOSTransactedAmount(fromDate, toDate, lastShiftClosingDate) {
        return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").callBespoke('getPOSTransactedAmount', fromDate, toDate, lastShiftClosingDate));
    }
}
_DatabaseHandler_fyo = new WeakMap(), _DatabaseHandler_demux = new WeakMap(), _DatabaseHandler_schemaMap = new WeakMap(), _DatabaseHandler_fieldMap = new WeakMap(), _DatabaseHandler_instances = new WeakSet(), _DatabaseHandler_getAll = 
/**
 * Internal methods
 */
async function _DatabaseHandler_getAll(schemaName, options = {}) {
    return (await __classPrivateFieldGet(this, _DatabaseHandler_demux, "f").call('getAll', schemaName, options));
}, _DatabaseHandler_setFieldMap = function _DatabaseHandler_setFieldMap() {
    __classPrivateFieldSet(this, _DatabaseHandler_fieldMap, Object.values(this.schemaMap).reduce((acc, sch) => {
        if (!sch?.name) {
            return acc;
        }
        acc[sch?.name] = getMapFromList(sch?.fields, 'fieldname');
        return acc;
    }, {}), "f");
};
//# sourceMappingURL=dbHandler.js.map