var _Fyo_instances, _Fyo_initializeModules, _Fyo_initializeMoneyMaker;
import { __classPrivateFieldGet } from "tslib";
import { getMoneyMaker } from 'pesa';
import { getIsNullOrUndef } from 'utils';
import { markRaw } from 'vue';
import { AuthHandler } from './core/authHandler';
import { DatabaseHandler } from './core/dbHandler';
import { DocHandler } from './core/docHandler';
import { Config } from './demux/config';
import { TelemetryManager } from './telemetry/telemetry';
import { DEFAULT_CURRENCY, DEFAULT_DISPLAY_PRECISION, DEFAULT_INTERNAL_PRECISION, } from './utils/consts';
import * as errors from './utils/errors';
import { format } from './utils/format';
import { t, T } from './utils/translation';
export class Fyo {
    constructor(conf = {}) {
        _Fyo_instances.add(this);
        this.t = t;
        this.T = T;
        this.errors = errors;
        this._initialized = false;
        this.errorLog = [];
        this.currencySymbols = {};
        this.store = {
            isDevelopment: false,
            skipTelemetryLogging: false,
            appVersion: '',
            platform: '',
            language: '',
            instanceId: '',
            deviceId: '',
            openCount: -1,
            appFlags: {},
            reports: {},
        };
        this.isTest = conf.isTest ?? false;
        this.isElectron = conf.isElectron ?? true;
        this.auth = new AuthHandler(this, conf.AuthDemux);
        this.db = new DatabaseHandler(this, conf.DatabaseDemux);
        this.doc = new DocHandler(this);
        this.pesa = getMoneyMaker({
            currency: DEFAULT_CURRENCY,
            precision: DEFAULT_INTERNAL_PRECISION,
            display: DEFAULT_DISPLAY_PRECISION,
            wrapper: markRaw,
        });
        this.telemetry = new TelemetryManager(this);
        this.config = new Config(this.isElectron && !this.isTest);
    }
    get initialized() {
        return this._initialized;
    }
    get docs() {
        return this.doc.docs;
    }
    get models() {
        return this.doc.models;
    }
    get singles() {
        return this.doc.singles;
    }
    get schemaMap() {
        return this.db.schemaMap;
    }
    get fieldMap() {
        return this.db.fieldMap;
    }
    format(value, field, doc) {
        return format(value, field, doc ?? null, this);
    }
    setIsElectron() {
        try {
            this.isElectron = !!window?.ipc;
        }
        catch {
            this.isElectron = false;
        }
    }
    async initializeAndRegister(models = {}, regionalModels = {}, force = false) {
        if (this._initialized && !force)
            return;
        await __classPrivateFieldGet(this, _Fyo_instances, "m", _Fyo_initializeModules).call(this);
        await __classPrivateFieldGet(this, _Fyo_instances, "m", _Fyo_initializeMoneyMaker).call(this);
        this.doc.registerModels(models, regionalModels);
        await this.doc.getDoc('SystemSettings');
        this._initialized = true;
    }
    async close() {
        await this.db.close();
    }
    getField(schemaName, fieldname) {
        return this.fieldMap[schemaName]?.[fieldname];
    }
    async getValue(schemaName, name, fieldname) {
        if (fieldname === undefined && this.schemaMap[schemaName]?.isSingle) {
            fieldname = name;
            name = schemaName;
        }
        if (getIsNullOrUndef(name) || getIsNullOrUndef(fieldname)) {
            return undefined;
        }
        let doc;
        let value;
        try {
            doc = await this.doc.getDoc(schemaName, name);
            value = doc.get(fieldname);
        }
        catch (err) {
            value = undefined;
        }
        if (value === undefined && schemaName === name) {
            const sv = await this.db.getSingleValues({
                fieldname: fieldname,
                parent: schemaName,
            });
            return sv?.[0]?.value;
        }
        return value;
    }
    async purgeCache() {
        this.pesa = getMoneyMaker({
            currency: DEFAULT_CURRENCY,
            precision: DEFAULT_INTERNAL_PRECISION,
            display: DEFAULT_DISPLAY_PRECISION,
            wrapper: markRaw,
        });
        this._initialized = false;
        this.temp = {};
        this.currencyFormatter = undefined;
        this.currencySymbols = {};
        this.errorLog = [];
        this.temp = {};
        await this.db.purgeCache();
        this.doc.purgeCache();
    }
}
_Fyo_instances = new WeakSet(), _Fyo_initializeModules = async function _Fyo_initializeModules() {
    // temp params while calling routes
    this.temp = {};
    this.doc.init();
    this.auth.init();
    await this.db.init();
}, _Fyo_initializeMoneyMaker = async function _Fyo_initializeMoneyMaker() {
    const values = (await this.db?.getSingleValues({
        fieldname: 'internalPrecision',
        parent: 'SystemSettings',
    }, {
        fieldname: 'displayPrecision',
        parent: 'SystemSettings',
    }, {
        fieldname: 'currency',
        parent: 'SystemSettings',
    })) ?? [];
    const acc = values.reduce((acc, sv) => {
        acc[sv.fieldname] = sv.value;
        return acc;
    }, {});
    const precision = acc.internalPrecision ?? DEFAULT_INTERNAL_PRECISION;
    const display = acc.displayPrecision ?? DEFAULT_DISPLAY_PRECISION;
    const currency = acc.currency ?? DEFAULT_CURRENCY;
    this.pesa = getMoneyMaker({
        currency,
        precision,
        display,
        wrapper: markRaw,
    });
};
export { T, t };
//# sourceMappingURL=index.js.map