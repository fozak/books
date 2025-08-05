import { FieldTypeEnum, } from 'schemas/types';
import { generateCSV } from 'utils/csvParser';
import { getMapFromList, safeParseFloat } from 'utils/index';
const excludedFieldTypes = [
    FieldTypeEnum.AttachImage,
    FieldTypeEnum.Attachment,
];
export function getExportFields(fields, exclude = []) {
    return fields
        .filter((f) => !f.computed && f.label && !exclude.includes(f.fieldname))
        .map((field) => {
        const { fieldname, label } = field;
        const fieldtype = field.fieldtype;
        return {
            fieldname,
            fieldtype,
            label,
            export: !excludedFieldTypes.includes(fieldtype),
        };
    });
}
export function getExportTableFields(fields, fyo) {
    return fields
        .filter((f) => f.fieldtype === FieldTypeEnum.Table)
        .map((f) => {
        const target = f.target;
        const tableFields = fyo.schemaMap[target]?.fields ?? [];
        const exportTableFields = getExportFields(tableFields, ['name']);
        return {
            fieldname: f.fieldname,
            label: f.label,
            target,
            fields: exportTableFields,
        };
    })
        .filter((f) => !!f.fields.length);
}
export async function getJsonExportData(schemaName, fields, tableFields, limit, filters, fyo) {
    const data = await getExportData(schemaName, fields, tableFields, limit, filters, fyo);
    convertParentDataToJsonExport(data.parentData, data.childTableData);
    return JSON.stringify(data.parentData);
}
export async function getCsvExportData(schemaName, fields, tableFields, limit, filters, fyo) {
    const { childTableData, parentData } = await getExportData(schemaName, fields, tableFields, limit, filters, fyo);
    /**
     * parentNameMap: Record<ParentName, Record<ParentFieldName, Rows[]>>
     */
    const parentNameMap = getParentNameMap(childTableData);
    const headers = getCsvHeaders(schemaName, fields, tableFields);
    const rows = [];
    for (const parentRow of parentData) {
        const parentName = parentRow.name;
        if (!parentName) {
            continue;
        }
        const baseRowData = headers.parent.map((f) => parentRow[f.fieldname] ?? '');
        const tableFieldRowMap = parentNameMap[parentName];
        if (!tableFieldRowMap || !Object.keys(tableFieldRowMap ?? {}).length) {
            rows.push([baseRowData, headers.child.map(() => '')].flat());
            continue;
        }
        for (const tableFieldName in tableFieldRowMap) {
            const tableRows = tableFieldRowMap[tableFieldName] ?? [];
            for (const tableRow of tableRows) {
                const tableRowData = headers.child.map((f) => {
                    if (f.parentFieldname !== tableFieldName) {
                        return '';
                    }
                    return tableRow[f.fieldname] ?? '';
                });
                rows.push([baseRowData, tableRowData].flat());
            }
        }
    }
    const flatHeaders = [headers.parent, headers.child].flat();
    const labels = flatHeaders.map((f) => f.label);
    const keys = flatHeaders.map((f) => `${f.schemaName}.${f.fieldname}`);
    rows.unshift(keys);
    rows.unshift(labels);
    return generateCSV(rows);
}
function getCsvHeaders(schemaName, fields, tableFields) {
    const headers = {
        parent: [],
        child: [],
    };
    for (const { label, fieldname, fieldtype, export: shouldExport } of fields) {
        if (!shouldExport || fieldtype === FieldTypeEnum.Table) {
            continue;
        }
        headers.parent.push({ schemaName, label, fieldname });
    }
    for (const tf of tableFields) {
        if (!fields.find((f) => f.fieldname === tf.fieldname)?.export) {
            continue;
        }
        for (const field of tf.fields) {
            if (!field.export) {
                continue;
            }
            headers.child.push({
                schemaName: tf.target,
                label: field.label,
                fieldname: field.fieldname,
                parentFieldname: tf.fieldname,
            });
        }
    }
    return headers;
}
function getParentNameMap(childTableData) {
    var _a;
    const parentNameMap = {};
    for (const key in childTableData) {
        for (const row of childTableData[key]) {
            const parent = row.parent;
            if (!parent) {
                continue;
            }
            parentNameMap[parent] ?? (parentNameMap[parent] = {});
            (_a = parentNameMap[parent])[key] ?? (_a[key] = []);
            parentNameMap[parent][key].push(row);
        }
    }
    return parentNameMap;
}
async function getExportData(schemaName, fields, tableFields, limit, filters, fyo) {
    const parentData = await getParentData(schemaName, filters, fields, limit, fyo);
    const parentNames = parentData.map((f) => f.name).filter(Boolean);
    const childTableData = await getAllChildTableData(tableFields, fields, parentNames, fyo);
    return { parentData, childTableData };
}
function convertParentDataToJsonExport(parentData, childTableData) {
    /**
     * Map from List does not create copies. Map is a
     * map of references, hence parentData is altered.
     */
    var _a;
    const nameMap = getMapFromList(parentData, 'name');
    for (const fieldname in childTableData) {
        const data = childTableData[fieldname];
        for (const row of data) {
            const parent = row.parent;
            if (!parent || !nameMap?.[parent]) {
                continue;
            }
            (_a = nameMap[parent])[fieldname] ?? (_a[fieldname] = []);
            delete row.parent;
            delete row.name;
            nameMap[parent][fieldname].push(row);
        }
    }
}
async function getParentData(schemaName, filters, fields, limit, fyo) {
    const orderBy = ['created'];
    if (fyo.db.fieldMap[schemaName]['date']) {
        orderBy.unshift('date');
    }
    const options = { filters, orderBy, order: 'desc' };
    if (limit) {
        options.limit = limit;
    }
    options.fields = fields
        .filter((f) => f.export && f.fieldtype !== FieldTypeEnum.Table)
        .map((f) => f.fieldname);
    if (!options.fields.includes('name')) {
        options.fields.unshift('name');
    }
    const data = await fyo.db.getAllRaw(schemaName, options);
    convertRawPesaToFloat(data, fields);
    return data;
}
async function getAllChildTableData(tableFields, parentFields, parentNames, fyo) {
    const childTables = {};
    // Getting Child Row data
    for (const tf of tableFields) {
        const f = parentFields.find((f) => f.fieldname === tf.fieldname);
        if (!f?.export) {
            continue;
        }
        childTables[tf.fieldname] = await getChildTableData(tf, parentNames, fyo);
    }
    return childTables;
}
async function getChildTableData(exportTableField, parentNames, fyo) {
    const exportTableFields = exportTableField.fields
        .filter((f) => f.export && f.fieldtype !== FieldTypeEnum.Table)
        .map((f) => f.fieldname);
    if (!exportTableFields.includes('parent')) {
        exportTableFields.unshift('parent');
    }
    const data = await fyo.db.getAllRaw(exportTableField.target, {
        orderBy: 'idx',
        fields: exportTableFields,
        filters: { parent: ['in', parentNames] },
    });
    convertRawPesaToFloat(data, exportTableField.fields);
    return data;
}
function convertRawPesaToFloat(data, fields) {
    const currencyFields = fields.filter((f) => f.fieldtype === FieldTypeEnum.Currency);
    for (const row of data) {
        for (const { fieldname } of currencyFields) {
            row[fieldname] = safeParseFloat((row[fieldname] ?? '0'));
        }
    }
}
//# sourceMappingURL=export.js.map