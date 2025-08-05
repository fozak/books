var _DatabaseCore_instances, _DatabaseCore_getCreateAlterList, _DatabaseCore_tableExists, _DatabaseCore_singleExists, _DatabaseCore_dropColumns, _DatabaseCore_getTableColumns, _DatabaseCore_getForeignKeys, _DatabaseCore_getQueryBuilder, _DatabaseCore_applyFiltersToBuilder, _DatabaseCore_getFiltersArray, _DatabaseCore_getColumnDiff, _DatabaseCore_getNewForeignKeys, _DatabaseCore_buildColumnForTable, _DatabaseCore_alterTable, _DatabaseCore_createTable, _DatabaseCore_runCreateTableQuery, _DatabaseCore_getNonExtantSingleValues, _DatabaseCore_deleteOne, _DatabaseCore_deleteSingle, _DatabaseCore_deleteChildren, _DatabaseCore_runDeleteOtherChildren, _DatabaseCore_prepareChild, _DatabaseCore_addForeignKeys, _DatabaseCore_loadChildren, _DatabaseCore_getOne, _DatabaseCore_getSingle, _DatabaseCore_insertOne, _DatabaseCore_updateSingleValues, _DatabaseCore_updateSingleValue, _DatabaseCore_insertSingleValue, _DatabaseCore_getSinglesUpdateList, _DatabaseCore_initializeSingles, _DatabaseCore_updateNonExtantSingleValues, _DatabaseCore_updateOne, _DatabaseCore_insertOrUpdateChildren, _DatabaseCore_getTableFields;
import { __classPrivateFieldGet } from "tslib";
import { getDbError, NotFoundError, ValueError } from 'fyo/utils/errors';
import { knex } from 'knex';
import { FieldTypeEnum, } from '../../schemas/types';
import { getIsNullOrUndef, getRandomString, getValueMapFromList, } from '../../utils';
import { DatabaseBase } from '../../utils/db/types';
import { getDefaultMetaFieldValueMap, sqliteTypeMap, SYSTEM } from '../helpers';
/**
 * # DatabaseCore
 * This is the ORM, the DatabaseCore interface (function signatures) should be
 * replicated by the frontend demuxes and all the backend muxes.
 *
 * ## Db Core Call Sequence
 *
 * 1. Init core: `const db = new DatabaseCore(dbPath)`.
 * 2. Connect db: `db.connect()`. This will allow for raw queries to be executed.
 * 3. Set schemas: `db.setSchemaMap(schemaMap)`. This will allow for ORM functions to be executed.
 * 4. Migrate: `await db.migrate()`. This will create absent tables and update the tables' shape.
 * 5. ORM function execution: `db.get(...)`, `db.insert(...)`, etc.
 * 6. Close connection: `await db.close()`.
 *
 * Note: Meta values: created, modified, createdBy, modifiedBy are set by DatabaseCore
 * only for schemas that are SingleValue. Else they have to be passed by the caller in
 * the `fieldValueMap`.
 */
export default class DatabaseCore extends DatabaseBase {
    constructor(dbPath) {
        super();
        _DatabaseCore_instances.add(this);
        this.typeMap = sqliteTypeMap;
        this.schemaMap = {};
        this.dbPath = dbPath ?? ':memory:';
        this.connectionParams = {
            client: 'better-sqlite3',
            connection: {
                filename: this.dbPath,
            },
            useNullAsDefault: true,
            asyncStackTraces: process.env.NODE_ENV === 'development',
        };
    }
    static async getCountryCode(dbPath) {
        let countryCode = 'in';
        const db = new DatabaseCore(dbPath);
        await db.connect();
        let query = [];
        try {
            query = (await db.knex('SingleValue').where({
                fieldname: 'countryCode',
                parent: 'SystemSettings',
            }));
        }
        catch {
            // Database not inialized and no countryCode passed
        }
        if (query.length > 0) {
            countryCode = query[0].value;
        }
        await db.close();
        return countryCode;
    }
    setSchemaMap(schemaMap) {
        this.schemaMap = schemaMap;
    }
    async connect() {
        this.knex = knex(this.connectionParams);
        await this.knex.raw('PRAGMA foreign_keys=ON');
    }
    async close() {
        await this.knex.destroy();
    }
    async migrate(config = {}) {
        const { create, alter } = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getCreateAlterList).call(this);
        const hasSingleValueTable = !create.includes('SingleValue');
        let singlesConfig = {
            update: [],
            updateNonExtant: [],
        };
        if (hasSingleValueTable) {
            singlesConfig = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getSinglesUpdateList).call(this);
        }
        const shouldMigrate = !!(create.length ||
            alter.length ||
            singlesConfig.update.length ||
            singlesConfig.updateNonExtant.length);
        if (!shouldMigrate) {
            return;
        }
        await config.pre?.();
        for (const schemaName of create) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_createTable).call(this, schemaName);
        }
        for (const config of alter) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_alterTable).call(this, config);
        }
        if (!hasSingleValueTable) {
            singlesConfig = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getSinglesUpdateList).call(this);
        }
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_initializeSingles).call(this, singlesConfig);
        await config.post?.();
    }
    async exists(schemaName, name) {
        const schema = this.schemaMap[schemaName];
        if (schema.isSingle) {
            return __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_singleExists).call(this, schemaName);
        }
        let row = [];
        try {
            const qb = this.knex(schemaName);
            if (name !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                qb.where({ name });
            }
            row = await qb.limit(1);
        }
        catch (err) {
            if (getDbError(err) !== NotFoundError) {
                throw err;
            }
        }
        return row.length > 0;
    }
    async insert(schemaName, fieldValueMap) {
        // insert parent
        if (this.schemaMap[schemaName].isSingle) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateSingleValues).call(this, schemaName, fieldValueMap);
        }
        else {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_insertOne).call(this, schemaName, fieldValueMap);
        }
        // insert children
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_insertOrUpdateChildren).call(this, schemaName, fieldValueMap, false);
        return fieldValueMap;
    }
    async get(schemaName, name = '', fields) {
        const schema = this.schemaMap[schemaName];
        if (!schema.isSingle && !name) {
            throw new ValueError('name is mandatory');
        }
        /**
         * If schema is single return all the values
         * of the single type schema, in this case field
         * is ignored.
         */
        let fieldValueMap = {};
        if (schema.isSingle) {
            return await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getSingle).call(this, schemaName);
        }
        if (typeof fields === 'string') {
            fields = [fields];
        }
        if (fields === undefined) {
            fields = schema.fields.filter((f) => !f.computed).map((f) => f.fieldname);
        }
        /**
         * Separate table fields and non table fields
         */
        const allTableFields = __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getTableFields).call(this, schemaName);
        const allTableFieldNames = allTableFields.map((f) => f.fieldname);
        const tableFields = allTableFields.filter((f) => fields.includes(f.fieldname));
        const nonTableFieldNames = fields.filter((f) => !allTableFieldNames.includes(f));
        /**
         * If schema is not single then return specific fields
         * if child fields are selected, all child fields are returned.
         */
        if (nonTableFieldNames.length) {
            fieldValueMap =
                (await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getOne).call(this, schemaName, name, nonTableFieldNames)) ?? {};
        }
        if (tableFields.length) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_loadChildren).call(this, name, fieldValueMap, tableFields);
        }
        return fieldValueMap;
    }
    async getAll(schemaName, options = {}) {
        const schema = this.schemaMap[schemaName];
        if (schema === undefined) {
            throw new NotFoundError(`schema ${schemaName} not found`);
        }
        const hasCreated = !!schema.fields.find((f) => f.fieldname === 'created');
        const { fields = ['name'], filters, offset, limit, groupBy, orderBy = hasCreated ? 'created' : undefined, order = 'desc', } = options;
        return (await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getQueryBuilder).call(this, schemaName, typeof fields === 'string' ? [fields] : fields, filters ?? {}, {
            offset,
            limit,
            groupBy,
            orderBy,
            order,
        }));
    }
    async deleteAll(schemaName, filters) {
        const builder = this.knex(schemaName);
        __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_applyFiltersToBuilder).call(this, builder, filters);
        return await builder.delete();
    }
    async getSingleValues(...fieldnames) {
        const fieldnameList = fieldnames.map((fieldname) => {
            if (typeof fieldname === 'string') {
                return { fieldname };
            }
            return fieldname;
        });
        let builder = this.knex('SingleValue');
        builder = builder.where(fieldnameList[0]);
        fieldnameList.slice(1).forEach(({ fieldname, parent }) => {
            if (typeof parent === 'undefined') {
                builder = builder.orWhere({ fieldname });
            }
            else {
                builder = builder.orWhere({ fieldname, parent });
            }
        });
        let values = [];
        try {
            values = await builder.select('fieldname', 'value', 'parent');
        }
        catch (err) {
            if (getDbError(err) === NotFoundError) {
                return [];
            }
            throw err;
        }
        return values;
    }
    async rename(schemaName, oldName, newName) {
        /**
         * Rename is expensive mostly won't allow it.
         * TODO: rename all links
         * TODO: rename in childtables
         */
        await this.knex(schemaName)
            .update({ name: newName })
            .where('name', oldName);
    }
    async update(schemaName, fieldValueMap) {
        // update parent
        if (this.schemaMap[schemaName].isSingle) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateSingleValues).call(this, schemaName, fieldValueMap);
        }
        else {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateOne).call(this, schemaName, fieldValueMap);
        }
        // insert or update children
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_insertOrUpdateChildren).call(this, schemaName, fieldValueMap, true);
    }
    async delete(schemaName, name) {
        const schema = this.schemaMap[schemaName];
        if (schema.isSingle) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_deleteSingle).call(this, schemaName, name);
            return;
        }
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_deleteOne).call(this, schemaName, name);
        // delete children
        const tableFields = __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getTableFields).call(this, schemaName);
        for (const field of tableFields) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_deleteChildren).call(this, field.target, name);
        }
    }
    async prestigeTheTable(schemaName, tableRows) {
        // Alter table hacx for sqlite in case of schema change.
        const tempName = `__${schemaName}`;
        // Create replacement table
        await this.knex.schema.dropTableIfExists(tempName);
        await this.knex.raw('PRAGMA foreign_keys=OFF');
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_createTable).call(this, schemaName, tempName);
        // Insert rows from source table into the replacement table
        await this.knex.batchInsert(tempName, tableRows, 200);
        // Replace with the replacement table
        await this.knex.schema.dropTable(schemaName);
        await this.knex.schema.renameTable(tempName, schemaName);
        await this.knex.raw('PRAGMA foreign_keys=ON');
    }
    async truncate(tableNames) {
        if (tableNames === undefined) {
            const q = (await this.knex.raw(`
        select name from sqlite_schema
        where type='table'
        and name not like 'sqlite_%'`));
            tableNames = q.map((i) => i.name);
        }
        for (const name of tableNames) {
            await this.knex(name).del();
        }
    }
}
_DatabaseCore_instances = new WeakSet(), _DatabaseCore_getCreateAlterList = async function _DatabaseCore_getCreateAlterList() {
    const create = [];
    const alter = [];
    for (const [schemaName, schema] of Object.entries(this.schemaMap)) {
        if (!schema || schema.isSingle) {
            continue;
        }
        const exists = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_tableExists).call(this, schemaName);
        if (!exists) {
            create.push(schemaName);
            continue;
        }
        const diff = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getColumnDiff).call(this, schemaName);
        const newForeignKeys = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getNewForeignKeys).call(this, schemaName);
        if (diff.added.length || diff.removed.length || newForeignKeys.length) {
            alter.push({
                schemaName,
                diff,
                newForeignKeys,
            });
        }
    }
    return { create, alter };
}, _DatabaseCore_tableExists = async function _DatabaseCore_tableExists(schemaName) {
    return await this.knex.schema.hasTable(schemaName);
}, _DatabaseCore_singleExists = async function _DatabaseCore_singleExists(singleSchemaName) {
    const res = await this.knex('SingleValue')
        .count('parent as count')
        .where('parent', singleSchemaName)
        .first();
    if (typeof res?.count === 'number') {
        return res.count > 0;
    }
    return false;
}, _DatabaseCore_dropColumns = async function _DatabaseCore_dropColumns(schemaName, targetColumns) {
    await this.knex.schema.table(schemaName, (table) => {
        table.dropColumns(...targetColumns);
    });
}, _DatabaseCore_getTableColumns = async function _DatabaseCore_getTableColumns(schemaName) {
    const info = await this.knex.raw(`PRAGMA table_info(${schemaName})`);
    return info.map((d) => d.name);
}, _DatabaseCore_getForeignKeys = async function _DatabaseCore_getForeignKeys(schemaName) {
    const foreignKeyList = await this.knex.raw(`PRAGMA foreign_key_list(${schemaName})`);
    return foreignKeyList.map((d) => d.from);
}, _DatabaseCore_getQueryBuilder = function _DatabaseCore_getQueryBuilder(schemaName, fields, filters, options) {
    /* eslint-disable @typescript-eslint/no-floating-promises */
    const builder = this.knex.select(fields).from(schemaName);
    __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_applyFiltersToBuilder).call(this, builder, filters);
    const { orderBy, groupBy, order } = options;
    if (Array.isArray(orderBy)) {
        builder.orderBy(orderBy.map((column) => ({ column, order })));
    }
    if (typeof orderBy === 'string') {
        builder.orderBy(orderBy, order);
    }
    if (Array.isArray(groupBy)) {
        builder.groupBy(...groupBy);
    }
    if (typeof groupBy === 'string') {
        builder.groupBy(groupBy);
    }
    if (options.offset) {
        builder.offset(options.offset);
    }
    if (options.limit) {
        builder.limit(options.limit);
    }
    return builder;
}, _DatabaseCore_applyFiltersToBuilder = function _DatabaseCore_applyFiltersToBuilder(builder, filters) {
    // {"status": "Open"} => `status = "Open"`
    // {"status": "Open", "name": ["like", "apple%"]}
    // => `status="Open" and name like "apple%"
    // {"date": [">=", "2017-09-09", "<=", "2017-11-01"]}
    // => `date >= 2017-09-09 and date <= 2017-11-01`
    const filtersArray = __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getFiltersArray).call(this, filters);
    for (let i = 0; i < filtersArray.length; i++) {
        const filter = filtersArray[i];
        const field = filter[0];
        const operator = filter[1];
        const comparisonValue = filter[2];
        const type = i === 0 ? 'where' : 'andWhere';
        if (operator === '=') {
            builder[type](field, comparisonValue);
        }
        else if (operator === 'in' &&
            comparisonValue.includes(null)) {
            const nonNulls = comparisonValue.filter(Boolean);
            builder[type](field, operator, nonNulls).orWhere(field, null);
        }
        else {
            builder[type](field, operator, comparisonValue);
        }
    }
}, _DatabaseCore_getFiltersArray = function _DatabaseCore_getFiltersArray(filters) {
    const filtersArray = [];
    for (const field in filters) {
        const value = filters[field];
        let operator = '=';
        let comparisonValue = value;
        if (Array.isArray(value)) {
            operator = value[0].toLowerCase();
            comparisonValue = value[1];
            if (operator === 'includes') {
                operator = 'like';
            }
            if (operator === 'like' &&
                typeof comparisonValue === 'string' &&
                !comparisonValue.includes('%')) {
                comparisonValue = `%${comparisonValue}%`;
            }
        }
        filtersArray.push([field, operator, comparisonValue]);
        if (Array.isArray(value) && value.length > 2) {
            // multiple conditions
            const operator = value[2];
            const comparisonValue = value[3];
            filtersArray.push([field, operator, comparisonValue]);
        }
    }
    return filtersArray;
}, _DatabaseCore_getColumnDiff = async function _DatabaseCore_getColumnDiff(schemaName) {
    const tableColumns = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getTableColumns).call(this, schemaName);
    const validFields = this.schemaMap[schemaName].fields.filter((f) => !f.computed);
    const diff = { added: [], removed: [] };
    for (const field of validFields) {
        const hasDbType = this.typeMap.hasOwnProperty(field.fieldtype);
        if (!tableColumns.includes(field.fieldname) && hasDbType) {
            diff.added.push(field);
        }
    }
    const validFieldNames = validFields.map((field) => field.fieldname);
    for (const column of tableColumns) {
        if (!validFieldNames.includes(column)) {
            diff.removed.push(column);
        }
    }
    return diff;
}, _DatabaseCore_getNewForeignKeys = async function _DatabaseCore_getNewForeignKeys(schemaName) {
    const foreignKeys = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getForeignKeys).call(this, schemaName);
    const newForeignKeys = [];
    const schema = this.schemaMap[schemaName];
    for (const field of schema.fields) {
        if (field.fieldtype === 'Link' &&
            !foreignKeys.includes(field.fieldname)) {
            newForeignKeys.push(field);
        }
    }
    return newForeignKeys;
}, _DatabaseCore_buildColumnForTable = function _DatabaseCore_buildColumnForTable(table, field) {
    if (field.fieldtype === FieldTypeEnum.Table) {
        // In case columnType is "Table"
        // childTable links are handled using the childTable's "parent" field
        return;
    }
    const columnType = this.typeMap[field.fieldtype];
    if (!columnType) {
        return;
    }
    const column = table[columnType](field.fieldname);
    // primary key
    if (field.fieldname === 'name') {
        column.primary();
    }
    // iefault value
    if (field.default !== undefined) {
        column.defaultTo(field.default);
    }
    // required
    if (field.required) {
        column.notNullable();
    }
    // link
    if (field.fieldtype === FieldTypeEnum.Link && field.target) {
        const targetSchemaName = field.target;
        const schema = this.schemaMap[targetSchemaName];
        table
            .foreign(field.fieldname)
            .references('name')
            .inTable(schema.name)
            .onUpdate('CASCADE')
            .onDelete('RESTRICT');
    }
}, _DatabaseCore_alterTable = async function _DatabaseCore_alterTable({ schemaName, diff, newForeignKeys }) {
    await this.knex.schema.table(schemaName, (table) => {
        if (!diff.added.length) {
            return;
        }
        for (const field of diff.added) {
            __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_buildColumnForTable).call(this, table, field);
        }
    });
    if (diff.removed.length) {
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_dropColumns).call(this, schemaName, diff.removed);
    }
    if (newForeignKeys.length) {
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_addForeignKeys).call(this, schemaName);
    }
}, _DatabaseCore_createTable = async function _DatabaseCore_createTable(schemaName, tableName) {
    tableName ?? (tableName = schemaName);
    const fields = this.schemaMap[schemaName].fields.filter((f) => !f.computed);
    return await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_runCreateTableQuery).call(this, tableName, fields);
}, _DatabaseCore_runCreateTableQuery = function _DatabaseCore_runCreateTableQuery(schemaName, fields) {
    return this.knex.schema.createTable(schemaName, (table) => {
        for (const field of fields) {
            __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_buildColumnForTable).call(this, table, field);
        }
    });
}, _DatabaseCore_getNonExtantSingleValues = async function _DatabaseCore_getNonExtantSingleValues(singleSchemaName) {
    const existingFields = (await this.knex('SingleValue')
        .where({ parent: singleSchemaName })
        .select('fieldname')).map(({ fieldname }) => fieldname);
    const nonExtant = [];
    const fields = this.schemaMap[singleSchemaName]?.fields ?? [];
    for (const { fieldname, default: value } of fields) {
        if (existingFields.includes(fieldname) || value === undefined) {
            continue;
        }
        nonExtant.push({ fieldname, value });
    }
    return nonExtant;
}, _DatabaseCore_deleteOne = async function _DatabaseCore_deleteOne(schemaName, name) {
    return await this.knex(schemaName).where('name', name).delete();
}, _DatabaseCore_deleteSingle = async function _DatabaseCore_deleteSingle(schemaName, fieldname) {
    return await this.knex('SingleValue')
        .where({ parent: schemaName, fieldname })
        .delete();
}, _DatabaseCore_deleteChildren = function _DatabaseCore_deleteChildren(schemaName, parentName) {
    return this.knex(schemaName).where('parent', parentName).delete();
}, _DatabaseCore_runDeleteOtherChildren = function _DatabaseCore_runDeleteOtherChildren(field, parentName, added) {
    // delete other children
    return this.knex(field.target)
        .where('parent', parentName)
        .andWhere('name', 'not in', added)
        .delete();
}, _DatabaseCore_prepareChild = function _DatabaseCore_prepareChild(parentSchemaName, parentName, child, field, idx) {
    if (!child.name) {
        child.name ?? (child.name = getRandomString());
    }
    child.parent = parentName;
    child.parentSchemaName = parentSchemaName;
    child.parentFieldname = field.fieldname;
    child.idx ?? (child.idx = idx);
}, _DatabaseCore_addForeignKeys = async function _DatabaseCore_addForeignKeys(schemaName) {
    const tableRows = await this.knex.select().from(schemaName);
    await this.prestigeTheTable(schemaName, tableRows);
}, _DatabaseCore_loadChildren = async function _DatabaseCore_loadChildren(parentName, fieldValueMap, tableFields) {
    for (const field of tableFields) {
        fieldValueMap[field.fieldname] = await this.getAll(field.target, {
            fields: ['*'],
            filters: { parent: parentName },
            orderBy: 'idx',
            order: 'asc',
        });
    }
}, _DatabaseCore_getOne = async function _DatabaseCore_getOne(schemaName, name, fields) {
    const fieldValueMap = (await this.knex.select(fields)
        .from(schemaName)
        .where('name', name)
        .first());
    return fieldValueMap;
}, _DatabaseCore_getSingle = async function _DatabaseCore_getSingle(schemaName) {
    const values = await this.getAll('SingleValue', {
        fields: ['fieldname', 'value'],
        filters: { parent: schemaName },
        orderBy: 'fieldname',
        order: 'asc',
    });
    const fieldValueMap = getValueMapFromList(values, 'fieldname', 'value');
    const tableFields = __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getTableFields).call(this, schemaName);
    if (tableFields.length) {
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_loadChildren).call(this, schemaName, fieldValueMap, tableFields);
    }
    return fieldValueMap;
}, _DatabaseCore_insertOne = function _DatabaseCore_insertOne(schemaName, fieldValueMap) {
    if (!fieldValueMap.name) {
        fieldValueMap.name = getRandomString();
    }
    // Column fields
    const fields = this.schemaMap[schemaName].fields.filter((f) => f.fieldtype !== FieldTypeEnum.Table && !f.computed);
    const validMap = {};
    for (const { fieldname } of fields) {
        validMap[fieldname] = fieldValueMap[fieldname];
    }
    return this.knex(schemaName).insert(validMap);
}, _DatabaseCore_updateSingleValues = async function _DatabaseCore_updateSingleValues(singleSchemaName, fieldValueMap) {
    const fields = this.schemaMap[singleSchemaName].fields.filter((f) => !f.computed && f.fieldtype !== 'Table');
    for (const field of fields) {
        const value = fieldValueMap[field.fieldname];
        if (value === undefined) {
            continue;
        }
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateSingleValue).call(this, singleSchemaName, field.fieldname, value);
    }
}, _DatabaseCore_updateSingleValue = async function _DatabaseCore_updateSingleValue(singleSchemaName, fieldname, value) {
    const updateKey = {
        parent: singleSchemaName,
        fieldname,
    };
    const names = (await this.knex('SingleValue')
        .select('name')
        .where(updateKey));
    if (!names?.length) {
        __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_insertSingleValue).call(this, singleSchemaName, fieldname, value);
    }
    else {
        return await this.knex('SingleValue').where(updateKey).update({
            value,
            modifiedBy: SYSTEM,
            modified: new Date().toISOString(),
        });
    }
}, _DatabaseCore_insertSingleValue = async function _DatabaseCore_insertSingleValue(singleSchemaName, fieldname, value) {
    const updateMap = getDefaultMetaFieldValueMap();
    const fieldValueMap = Object.assign({}, updateMap, {
        parent: singleSchemaName,
        fieldname,
        value,
        name: getRandomString(),
    });
    return await this.knex('SingleValue').insert(fieldValueMap);
}, _DatabaseCore_getSinglesUpdateList = async function _DatabaseCore_getSinglesUpdateList() {
    const update = [];
    const updateNonExtant = [];
    for (const [schemaName, schema] of Object.entries(this.schemaMap)) {
        if (!schema || !schema.isSingle) {
            continue;
        }
        const exists = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_singleExists).call(this, schemaName);
        if (!exists && schema.fields.some((f) => f.default !== undefined)) {
            update.push(schemaName);
        }
        if (!exists) {
            continue;
        }
        const nonExtant = await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getNonExtantSingleValues).call(this, schemaName);
        if (nonExtant.length) {
            updateNonExtant.push({
                schemaName,
                nonExtant,
            });
        }
    }
    return { update, updateNonExtant };
}, _DatabaseCore_initializeSingles = async function _DatabaseCore_initializeSingles({ update, updateNonExtant }) {
    for (const config of updateNonExtant) {
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateNonExtantSingleValues).call(this, config);
    }
    for (const schemaName of update) {
        const fields = this.schemaMap[schemaName].fields;
        const defaultValues = fields.reduce((acc, f) => {
            if (f.default !== undefined) {
                acc[f.fieldname] = f.default;
            }
            return acc;
        }, {});
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateSingleValues).call(this, schemaName, defaultValues);
    }
}, _DatabaseCore_updateNonExtantSingleValues = async function _DatabaseCore_updateNonExtantSingleValues({ schemaName, nonExtant, }) {
    for (const { fieldname, value } of nonExtant) {
        await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateSingleValue).call(this, schemaName, fieldname, value);
    }
}, _DatabaseCore_updateOne = async function _DatabaseCore_updateOne(schemaName, fieldValueMap) {
    const updateMap = { ...fieldValueMap };
    delete updateMap.name;
    const schema = this.schemaMap[schemaName];
    for (const { fieldname, fieldtype, computed } of schema.fields) {
        if (fieldtype !== FieldTypeEnum.Table && !computed) {
            continue;
        }
        delete updateMap[fieldname];
    }
    if (Object.keys(updateMap).length === 0) {
        return;
    }
    return await this.knex(schemaName)
        .where('name', fieldValueMap.name)
        .update(updateMap);
}, _DatabaseCore_insertOrUpdateChildren = async function _DatabaseCore_insertOrUpdateChildren(schemaName, fieldValueMap, isUpdate) {
    let parentName = fieldValueMap.name;
    if (this.schemaMap[schemaName]?.isSingle) {
        parentName = schemaName;
    }
    const tableFields = __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_getTableFields).call(this, schemaName);
    for (const field of tableFields) {
        const added = [];
        const tableFieldValue = fieldValueMap[field.fieldname];
        if (getIsNullOrUndef(tableFieldValue)) {
            continue;
        }
        for (const child of tableFieldValue) {
            __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_prepareChild).call(this, schemaName, parentName, child, field, added.length);
            if (isUpdate &&
                (await this.exists(field.target, child.name))) {
                await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_updateOne).call(this, field.target, child);
            }
            else {
                await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_insertOne).call(this, field.target, child);
            }
            added.push(child.name);
        }
        if (isUpdate) {
            await __classPrivateFieldGet(this, _DatabaseCore_instances, "m", _DatabaseCore_runDeleteOtherChildren).call(this, field, parentName, added);
        }
    }
}, _DatabaseCore_getTableFields = function _DatabaseCore_getTableFields(schemaName) {
    return this.schemaMap[schemaName].fields.filter((f) => f.fieldtype === FieldTypeEnum.Table);
};
//# sourceMappingURL=core.js.map