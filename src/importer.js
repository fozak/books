import { Converter } from 'fyo/core/converter';
import { getEmptyValuesByFieldTypes } from 'fyo/utils';
import { ValidationError } from 'fyo/utils/errors';
import { FieldTypeEnum, } from 'schemas/types';
import { generateCSV, parseCSV } from 'utils/csvParser';
import { getValueMapFromList } from 'utils/index';
const skippedFieldsTypes = [
    FieldTypeEnum.AttachImage,
    FieldTypeEnum.Attachment,
    FieldTypeEnum.Table,
];
/**
 * Tool that
 * - Can make bulk entries for any kind of Doc
 * - Takes in unstructured CSV data, converts it into Docs
 * - Saves and or Submits the converted Docs
 */
export class Importer {
    constructor(schemaName, fyo) {
        if (!fyo.schemaMap[schemaName]) {
            throw new ValidationError(`Invalid schemaName ${schemaName} found in importer`);
        }
        this.hasChildTables = false;
        this.schemaName = schemaName;
        this.fyo = fyo;
        this.docs = [];
        this.valueMatrix = [];
        this.optionsMap = {
            values: {},
            labelValueMap: {},
        };
        const templateFields = getTemplateFields(schemaName, fyo, this);
        this.assignedTemplateFields = templateFields.map((f) => f.fieldKey);
        this.templateFieldsMap = new Map();
        this.templateFieldsPicked = new Map();
        templateFields.forEach((f) => {
            this.templateFieldsMap.set(f.fieldKey, f);
            this.templateFieldsPicked.set(f.fieldKey, true);
        });
    }
    selectFile(data) {
        try {
            const parsed = parseCSV(data);
            this.selectParsed(parsed);
        }
        catch {
            return false;
        }
        return true;
    }
    async checkLinks() {
        const tfKeys = this.assignedTemplateFields
            .map((key, index) => ({
            key,
            index,
            tf: this.templateFieldsMap.get(key ?? ''),
        }))
            .filter(({ key, tf }) => {
            if (!key || !tf) {
                return false;
            }
            return tf.fieldtype === FieldTypeEnum.Link;
        });
        const linksNames = new Map();
        for (const row of this.valueMatrix) {
            for (const { tf, index } of tfKeys) {
                const target = tf.target;
                const value = row[index]?.value;
                if (typeof value !== 'string' || !value) {
                    continue;
                }
                if (!linksNames.has(target)) {
                    linksNames.set(target, new Set());
                }
                linksNames.get(target)?.add(value);
            }
        }
        const doesNotExist = [];
        for (const [target, values] of linksNames.entries()) {
            for (const value of values) {
                const exists = await this.fyo.db.exists(target, value);
                if (exists) {
                    continue;
                }
                doesNotExist.push({
                    schemaName: target,
                    schemaLabel: this.fyo.schemaMap[this.schemaName]?.label,
                    name: value,
                });
            }
        }
        return doesNotExist;
    }
    checkCellErrors() {
        const assigned = this.assignedTemplateFields
            .map((key, index) => ({
            key,
            index,
            tf: this.templateFieldsMap.get(key ?? ''),
        }))
            .filter(({ key, tf }) => !!key && !!tf);
        const cellErrors = [];
        for (let i = 0; i < this.valueMatrix.length; i++) {
            const row = this.valueMatrix[i];
            for (const { tf, index } of assigned) {
                if (!row[index]?.error) {
                    continue;
                }
                const rowLabel = this.fyo.t `Row ${i + 1}`;
                const columnLabel = getColumnLabel(tf);
                cellErrors.push(`(${rowLabel}, ${columnLabel})`);
            }
        }
        return cellErrors;
    }
    populateDocs() {
        const { dataMap, childTableMap } = this.getDataAndChildTableMapFromValueMatrix();
        const schema = this.fyo.schemaMap[this.schemaName];
        const targetFieldnameMap = schema?.fields
            .filter((f) => f.fieldtype === FieldTypeEnum.Table)
            .reduce((acc, f) => {
            const { target, fieldname } = f;
            acc[target] = fieldname;
            return acc;
        }, {});
        for (const [name, data] of dataMap.entries()) {
            const doc = this.fyo.doc.getNewDoc(this.schemaName, data, false);
            for (const schemaName in targetFieldnameMap) {
                const fieldname = targetFieldnameMap[schemaName];
                const childTable = childTableMap[name]?.[schemaName];
                if (!childTable) {
                    continue;
                }
                for (const childData of childTable.values()) {
                    doc.push(fieldname, childData);
                }
            }
            this.docs.push(doc);
        }
    }
    getDataAndChildTableMapFromValueMatrix() {
        var _a, _b;
        /**
         * Record key is the doc.name value
         */
        const dataMap = new Map();
        /**
         * Record key is doc.name, childSchemaName, childDoc.name
         */
        const childTableMap = {};
        const nameIndices = this.assignedTemplateFields
            .map((key, index) => ({ key, index }))
            .filter((f) => f.key?.endsWith('.name'))
            .reduce((acc, f) => {
            if (f.key == null) {
                return acc;
            }
            const schemaName = f.key.split('.')[0];
            acc[schemaName] = f.index;
            return acc;
        }, {});
        const nameIndex = nameIndices?.[this.schemaName];
        if (nameIndex < 0) {
            return { dataMap, childTableMap };
        }
        for (let i = 0; i < this.valueMatrix.length; i++) {
            const row = this.valueMatrix[i];
            const name = row[nameIndex]?.value;
            if (typeof name !== 'string') {
                continue;
            }
            for (let j = 0; j < row.length; j++) {
                const key = this.assignedTemplateFields[j];
                const tf = this.templateFieldsMap.get(key ?? '');
                if (!tf || !key) {
                    continue;
                }
                const isChild = this.fyo.schemaMap[tf.schemaName]?.isChild;
                const vmi = row[j];
                if (vmi.value == null) {
                    continue;
                }
                if (!isChild && !dataMap.has(name)) {
                    dataMap.set(name, {});
                }
                if (!isChild) {
                    dataMap.get(name)[tf.fieldname] = vmi.value;
                    continue;
                }
                const childNameIndex = nameIndices[tf.schemaName];
                let childName = row[childNameIndex]?.value;
                if (typeof childName !== 'string') {
                    childName = `${tf.schemaName}-${i}`;
                }
                childTableMap[name] ?? (childTableMap[name] = {});
                (_a = childTableMap[name])[_b = tf.schemaName] ?? (_a[_b] = new Map());
                const childMap = childTableMap[name][tf.schemaName];
                if (!childMap.has(childName)) {
                    childMap.set(childName, {});
                }
                const childDocValueMap = childMap.get(childName);
                if (!childDocValueMap) {
                    continue;
                }
                childDocValueMap[tf.fieldname] = vmi.value;
            }
        }
        return { dataMap, childTableMap };
    }
    selectParsed(parsed) {
        if (!parsed?.length) {
            return;
        }
        let startIndex = -1;
        let templateFieldsAssigned;
        for (let i = 3; i >= 0; i--) {
            const row = parsed[i];
            if (!row?.length) {
                continue;
            }
            templateFieldsAssigned = this.assignTemplateFieldsFromParsedRow(row);
            if (templateFieldsAssigned) {
                startIndex = i + 1;
                break;
            }
        }
        if (!templateFieldsAssigned) {
            this.clearAndResizeAssignedTemplateFields(parsed[0].length);
        }
        if (startIndex === -1) {
            startIndex = 0;
        }
        this.assignValueMatrixFromParsed(parsed.slice(startIndex));
    }
    clearAndResizeAssignedTemplateFields(size) {
        for (let i = 0; i < size; i++) {
            if (i >= this.assignedTemplateFields.length) {
                this.assignedTemplateFields.push(null);
            }
            else {
                this.assignedTemplateFields[i] = null;
            }
        }
    }
    assignValueMatrixFromParsed(parsed) {
        if (!parsed?.length) {
            return;
        }
        for (const row of parsed) {
            this.pushToValueMatrixFromParsedRow(row);
        }
    }
    pushToValueMatrixFromParsedRow(row) {
        const vmRow = [];
        for (let i = 0; i < row.length; i++) {
            const rawValue = row[i];
            const index = Number(i);
            if (index >= this.assignedTemplateFields.length) {
                this.assignedTemplateFields.push(null);
            }
            vmRow.push(this.getValueMatrixItem(index, rawValue));
        }
        this.valueMatrix.push(vmRow);
    }
    setTemplateField(index, key) {
        if (index >= this.assignedTemplateFields.length) {
            this.assignedTemplateFields.push(key);
        }
        else {
            this.assignedTemplateFields[index] = key;
        }
        this.updateValueMatrixColumn(index);
    }
    updateValueMatrixColumn(index) {
        for (const row of this.valueMatrix) {
            const vmi = this.getValueMatrixItem(index, row[index].rawValue ?? null);
            if (index >= row.length) {
                row.push(vmi);
            }
            else {
                row[index] = vmi;
            }
        }
    }
    getValueMatrixItem(index, rawValue) {
        const vmi = { rawValue };
        const key = this.assignedTemplateFields[index];
        if (!key) {
            return vmi;
        }
        const tf = this.templateFieldsMap.get(key);
        if (!tf) {
            return vmi;
        }
        if (vmi.rawValue === '') {
            vmi.value = null;
            return vmi;
        }
        if ('options' in tf && typeof vmi.rawValue === 'string') {
            return this.getOptionFieldVmi(vmi, tf);
        }
        try {
            vmi.value = Converter.toDocValue(rawValue, tf, this.fyo);
        }
        catch {
            vmi.error = true;
        }
        return vmi;
    }
    getOptionFieldVmi({ rawValue }, tf) {
        if (typeof rawValue !== 'string') {
            return { error: true, value: null, rawValue };
        }
        if (!tf?.options.length) {
            return { value: null, rawValue };
        }
        if (!this.optionsMap.labelValueMap[tf.fieldKey]) {
            const values = new Set(tf.options.map(({ value }) => value));
            const labelValueMap = getValueMapFromList(tf.options, 'label', 'value');
            this.optionsMap.labelValueMap[tf.fieldKey] = labelValueMap;
            this.optionsMap.values[tf.fieldKey] = values;
        }
        const hasValue = this.optionsMap.values[tf.fieldKey].has(rawValue);
        if (hasValue) {
            return { value: rawValue, rawValue };
        }
        const value = this.optionsMap.labelValueMap[tf.fieldKey][rawValue];
        if (value) {
            return { value, rawValue };
        }
        return { error: true, value: null, rawValue };
    }
    assignTemplateFieldsFromParsedRow(row) {
        const isKeyRow = row.some((key) => this.templateFieldsMap.has(key));
        if (!isKeyRow) {
            return false;
        }
        for (let i = 0; i < row.length; i++) {
            const value = row[i];
            const tf = this.templateFieldsMap.get(value);
            let key = value;
            if (!tf) {
                key = null;
            }
            if (key !== null && !this.templateFieldsPicked.get(value)) {
                key = null;
            }
            if (Number(i) >= this.assignedTemplateFields.length) {
                this.assignedTemplateFields.push(key);
            }
            else {
                this.assignedTemplateFields[i] = key;
            }
        }
        return true;
    }
    addRow() {
        const valueRow = this.assignedTemplateFields.map((key) => {
            key ?? (key = '');
            const { fieldtype } = this.templateFieldsMap.get(key) ?? {};
            let value = null;
            if (fieldtype) {
                value = getEmptyValuesByFieldTypes(fieldtype, this.fyo);
            }
            return { value };
        });
        this.valueMatrix.push(valueRow);
    }
    removeRow(index) {
        this.valueMatrix = this.valueMatrix.filter((_, i) => i !== index);
    }
    getCSVTemplate() {
        const schemaLabels = [];
        const fieldLabels = [];
        const fieldKey = [];
        for (const [name, picked] of this.templateFieldsPicked.entries()) {
            if (!picked) {
                continue;
            }
            const field = this.templateFieldsMap.get(name);
            if (!field) {
                continue;
            }
            schemaLabels.push(field.schemaLabel);
            fieldLabels.push(field.label);
            fieldKey.push(field.fieldKey);
        }
        return generateCSV([schemaLabels, fieldLabels, fieldKey]);
    }
}
function getTemplateFields(schemaName, fyo, importer) {
    const schemas = [
        { schema: fyo.schemaMap[schemaName] },
    ];
    const fields = [];
    const targetSchemaFieldMap = fyo.schemaMap[importer.schemaName]?.fields.reduce((acc, f) => {
        if (!f.target) {
            return acc;
        }
        acc[f.fieldname] = f;
        return acc;
    }, {}) ?? {};
    while (schemas.length) {
        const { schema, parentSchemaChildField } = schemas.pop() ?? {};
        if (!schema) {
            continue;
        }
        for (const field of schema.fields) {
            if (shouldSkipField(field, schema)) {
                continue;
            }
            if (field.fieldtype === FieldTypeEnum.Table) {
                importer.hasChildTables = true;
                schemas.push({
                    schema: fyo.schemaMap[field.target],
                    parentSchemaChildField: field,
                });
            }
            if (skippedFieldsTypes.includes(field.fieldtype)) {
                continue;
            }
            const tf = { ...field };
            if (tf.readOnly) {
                tf.readOnly = false;
            }
            if (schema.isChild && tf.fieldname === 'name') {
                tf.required = false;
            }
            if (schema.isChild &&
                tf.required &&
                !targetSchemaFieldMap[tf.schemaName ?? '']?.required) {
                tf.required = false;
            }
            const schemaName = schema.name;
            const schemaLabel = schema.label;
            const fieldKey = `${schema.name}.${field.fieldname}`;
            fields.push({
                ...tf,
                schemaName,
                schemaLabel,
                fieldKey,
                parentSchemaChildField,
            });
        }
    }
    return fields;
}
export function getColumnLabel(field) {
    if (field.parentSchemaChildField) {
        return `${field.label} (${field.parentSchemaChildField.label})`;
    }
    return field.label;
}
function shouldSkipField(field, schema) {
    if (field.computed || field.meta) {
        return true;
    }
    if (schema.naming === 'numberSeries' && field.fieldname === 'name') {
        return false;
    }
    if (field.hidden) {
        return true;
    }
    if (field.readOnly && !field.required) {
        return true;
    }
    return false;
}
//# sourceMappingURL=importer.js.map