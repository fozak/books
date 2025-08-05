var _DatabaseManager_instances, _DatabaseManager_isInitialized_get, _DatabaseManager_migrate, _DatabaseManager_executeMigration, _DatabaseManager_getPatchesToExecute, _DatabaseManager_getIsFirstRun, _DatabaseManager_createBackup, _DatabaseManager_getBackupFilePath, _DatabaseManager_getAppVersion;
import { __classPrivateFieldGet } from "tslib";
import BetterSQLite3 from 'better-sqlite3';
import fs from 'fs-extra';
import { DatabaseError } from 'fyo/utils/errors';
import path from 'path';
import { DatabaseDemuxBase } from 'utils/db/types';
import { getMapFromList } from 'utils/index';
import { Version } from 'utils/version';
import { getSchemas } from '../../schemas';
import { databaseMethodSet, unlinkIfExists } from '../helpers';
import patches from '../patches';
import { BespokeQueries } from './bespoke';
import DatabaseCore from './core';
import { runPatches } from './runPatch';
export class DatabaseManager extends DatabaseDemuxBase {
    constructor() {
        super(...arguments);
        _DatabaseManager_instances.add(this);
        this.rawCustomFields = [];
    }
    getSchemaMap() {
        if (__classPrivateFieldGet(this, _DatabaseManager_instances, "a", _DatabaseManager_isInitialized_get)) {
            return this.db?.schemaMap ?? getSchemas('-', this.rawCustomFields);
        }
        return getSchemas('-', this.rawCustomFields);
    }
    async createNewDatabase(dbPath, countryCode) {
        await unlinkIfExists(dbPath);
        return await this.connectToDatabase(dbPath, countryCode);
    }
    async connectToDatabase(dbPath, countryCode) {
        countryCode = await this._connect(dbPath, countryCode);
        await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_migrate).call(this);
        return countryCode;
    }
    async _connect(dbPath, countryCode) {
        countryCode ?? (countryCode = await DatabaseCore.getCountryCode(dbPath));
        this.db = new DatabaseCore(dbPath);
        await this.db.connect();
        await this.setRawCustomFields();
        const schemaMap = getSchemas(countryCode, this.rawCustomFields);
        this.db.setSchemaMap(schemaMap);
        return countryCode;
    }
    async setRawCustomFields() {
        try {
            this.rawCustomFields = (await this.db?.knex?.('CustomField'));
        }
        catch { }
    }
    async call(method, ...args) {
        if (!__classPrivateFieldGet(this, _DatabaseManager_instances, "a", _DatabaseManager_isInitialized_get)) {
            return;
        }
        if (!databaseMethodSet.has(method)) {
            return;
        }
        // @ts-ignore
        const response = await this.db[method](...args);
        if (method === 'close') {
            delete this.db;
        }
        return response;
    }
    async callBespoke(method, ...args) {
        if (!__classPrivateFieldGet(this, _DatabaseManager_instances, "a", _DatabaseManager_isInitialized_get)) {
            return;
        }
        if (!BespokeQueries.hasOwnProperty(method)) {
            throw new DatabaseError(`invalid bespoke db function ${method}`);
        }
        const queryFunction = BespokeQueries[method];
        return await queryFunction(this.db, ...args);
    }
    getDriver() {
        const { dbPath } = this.db ?? {};
        if (!dbPath) {
            return null;
        }
        return BetterSQLite3(dbPath, { readonly: true });
    }
}
_DatabaseManager_instances = new WeakSet(), _DatabaseManager_isInitialized_get = function _DatabaseManager_isInitialized_get() {
    return this.db !== undefined && this.db.knex !== undefined;
}, _DatabaseManager_migrate = async function _DatabaseManager_migrate() {
    if (!__classPrivateFieldGet(this, _DatabaseManager_instances, "a", _DatabaseManager_isInitialized_get)) {
        return;
    }
    const isFirstRun = await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_getIsFirstRun).call(this);
    if (isFirstRun) {
        await this.db.migrate();
    }
    await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_executeMigration).call(this);
}, _DatabaseManager_executeMigration = async function _DatabaseManager_executeMigration() {
    const version = await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_getAppVersion).call(this);
    const patches = await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_getPatchesToExecute).call(this, version);
    const hasPatches = !!patches.pre.length || !!patches.post.length;
    if (hasPatches) {
        await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_createBackup).call(this);
    }
    await runPatches(patches.pre, this, version);
    await this.db.migrate({
        pre: async () => {
            if (hasPatches) {
                return;
            }
            await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_createBackup).call(this);
        },
    });
    await runPatches(patches.post, this, version);
}, _DatabaseManager_getPatchesToExecute = async function _DatabaseManager_getPatchesToExecute(version) {
    if (this.db === undefined) {
        return { pre: [], post: [] };
    }
    const query = (await this.db.knex('PatchRun').select());
    const runPatchesMap = getMapFromList(query, 'name');
    /**
     * A patch is run only if:
     * - it hasn't run and was added in a future version
     *    i.e. app version is before patch added version
     * - it ran but failed in some other version (i.e fixed)
     */
    const filtered = patches
        .filter((p) => {
        const exec = runPatchesMap[p.name];
        if (!exec && Version.lte(version, p.version)) {
            return true;
        }
        if (exec?.failed && exec?.version !== version) {
            return true;
        }
        return false;
    })
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return {
        pre: filtered.filter((p) => p.patch.beforeMigrate),
        post: filtered.filter((p) => !p.patch.beforeMigrate),
    };
}, _DatabaseManager_getIsFirstRun = async function _DatabaseManager_getIsFirstRun() {
    const knex = this.db?.knex;
    if (!knex) {
        return true;
    }
    const query = await knex('sqlite_master').where({
        type: 'table',
        name: 'PatchRun',
    });
    return !query.length;
}, _DatabaseManager_createBackup = async function _DatabaseManager_createBackup() {
    const { dbPath } = this.db ?? {};
    if (!dbPath || process.env.IS_TEST) {
        return;
    }
    const backupPath = await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_getBackupFilePath).call(this);
    if (!backupPath) {
        return;
    }
    const db = this.getDriver();
    await db?.backup(backupPath).then(() => db.close());
}, _DatabaseManager_getBackupFilePath = async function _DatabaseManager_getBackupFilePath() {
    const { dbPath } = this.db ?? {};
    if (dbPath === ':memory:' || !dbPath) {
        return null;
    }
    let fileName = path.parse(dbPath).name;
    if (fileName.endsWith('.books')) {
        fileName = fileName.slice(0, -6);
    }
    const backupFolder = path.join(path.dirname(dbPath), 'backups');
    const date = new Date().toISOString().split('T')[0];
    const version = await __classPrivateFieldGet(this, _DatabaseManager_instances, "m", _DatabaseManager_getAppVersion).call(this);
    const backupFile = `${fileName}_${version}_${date}.books.db`;
    fs.ensureDirSync(backupFolder);
    return path.join(backupFolder, backupFile);
}, _DatabaseManager_getAppVersion = async function _DatabaseManager_getAppVersion() {
    const knex = this.db?.knex;
    if (!knex) {
        return '0.0.0';
    }
    const query = await knex('SingleValue')
        .select('value')
        .where({ fieldname: 'version', parent: 'SystemSettings' });
    const value = query[0]?.value;
    return value || '0.0.0';
};
export default new DatabaseManager();
//# sourceMappingURL=manager.js.map