import { cloneDeep } from 'lodash';
import { getListFromMap, getMapFromList } from 'utils';
import regionalSchemas from './regional';
import { appSchemas, coreSchemas, metaSchemas } from './schemas';
const NAME_FIELD = {
    fieldname: 'name',
    label: `ID`,
    fieldtype: 'Data',
    required: true,
    readOnly: true,
};
export function getSchemas(countryCode = '-', rawCustomFields) {
    const builtCoreSchemas = getCoreSchemas();
    const builtAppSchemas = getAppSchemas(countryCode);
    let schemaMap = Object.assign({}, builtAppSchemas, builtCoreSchemas);
    schemaMap = addMetaFields(schemaMap);
    schemaMap = removeFields(schemaMap);
    schemaMap = setSchemaNameOnFields(schemaMap);
    addCustomFields(schemaMap, rawCustomFields);
    deepFreeze(schemaMap);
    return schemaMap;
}
export function setSchemaNameOnFields(schemaMap) {
    for (const schemaName in schemaMap) {
        const schema = schemaMap[schemaName];
        schema.fields = schema.fields.map((f) => ({ ...f, schemaName }));
    }
    return schemaMap;
}
function removeFields(schemaMap) {
    for (const schemaName in schemaMap) {
        const schema = schemaMap[schemaName];
        if (schema.removeFields === undefined) {
            continue;
        }
        for (const fieldname of schema.removeFields) {
            schema.fields = schema.fields.filter((f) => f.fieldname !== fieldname);
            schema.tableFields = schema.tableFields?.filter((fn) => fn !== fieldname);
            schema.quickEditFields = schema.quickEditFields?.filter((fn) => fn !== fieldname);
            schema.keywordFields = schema.keywordFields?.filter((fn) => fn !== fieldname);
            if (schema.linkDisplayField === fieldname) {
                delete schema.linkDisplayField;
            }
        }
        delete schema.removeFields;
    }
    return schemaMap;
}
function deepFreeze(schemaMap) {
    Object.freeze(schemaMap);
    for (const schemaName in schemaMap) {
        Object.freeze(schemaMap[schemaName]);
        for (const key in schemaMap[schemaName]) {
            // @ts-ignore
            Object.freeze(schemaMap[schemaName][key]);
        }
        for (const field of schemaMap[schemaName]?.fields ?? []) {
            Object.freeze(field);
        }
    }
}
export function addMetaFields(schemaMap) {
    const metaSchemaMap = getMapFromList(cloneDeep(metaSchemas), 'name');
    const base = metaSchemaMap.base;
    const tree = getCombined(metaSchemaMap.tree, base);
    const child = metaSchemaMap.child;
    const submittable = getCombined(metaSchemaMap.submittable, base);
    const submittableTree = getCombined(tree, metaSchemaMap.submittable);
    for (const name in schemaMap) {
        const schema = schemaMap[name];
        if (schema.isSingle) {
            continue;
        }
        if (schema.isTree && schema.isSubmittable) {
            schema.fields = [...schema.fields, ...submittableTree.fields];
        }
        else if (schema.isTree) {
            schema.fields = [...schema.fields, ...tree.fields];
        }
        else if (schema.isSubmittable) {
            schema.fields = [...schema.fields, ...submittable.fields];
        }
        else if (schema.isChild) {
            schema.fields = [...schema.fields, ...child.fields];
        }
        else {
            schema.fields = [...schema.fields, ...base.fields];
        }
    }
    addNameField(schemaMap);
    addTitleField(schemaMap);
    return schemaMap;
}
function addTitleField(schemaMap) {
    var _a;
    for (const schemaName in schemaMap) {
        (_a = schemaMap[schemaName]).titleField ?? (_a.titleField = 'name');
    }
}
function addNameField(schemaMap) {
    for (const name in schemaMap) {
        const schema = schemaMap[name];
        if (schema.isSingle) {
            continue;
        }
        const pkField = schema.fields.find((f) => f.fieldname === 'name');
        if (pkField !== undefined) {
            continue;
        }
        schema.fields.unshift(NAME_FIELD);
    }
}
function getCoreSchemas() {
    const rawSchemaMap = getMapFromList(cloneDeep(coreSchemas), 'name');
    const coreSchemaMap = getAbstractCombinedSchemas(rawSchemaMap);
    return cleanSchemas(coreSchemaMap);
}
function getAppSchemas(countryCode) {
    const appSchemaMap = getMapFromList(cloneDeep(appSchemas), 'name');
    const regionalSchemaMap = getRegionalSchemaMap(countryCode);
    const combinedSchemas = getRegionalCombinedSchemas(appSchemaMap, regionalSchemaMap);
    const schemaMap = getAbstractCombinedSchemas(combinedSchemas);
    return cleanSchemas(schemaMap);
}
export function cleanSchemas(schemaMap) {
    for (const name in schemaMap) {
        const schema = schemaMap[name];
        if (schema.isAbstract && !schema.extends) {
            delete schemaMap[name];
            continue;
        }
        delete schema.extends;
        delete schema.isAbstract;
    }
    return schemaMap;
}
function getCombined(extendingSchema, abstractSchema) {
    abstractSchema = cloneDeep(abstractSchema);
    extendingSchema = cloneDeep(extendingSchema);
    const abstractFields = getMapFromList(abstractSchema.fields ?? [], 'fieldname');
    const extendingFields = getMapFromList(extendingSchema.fields ?? [], 'fieldname');
    const combined = Object.assign(abstractSchema, extendingSchema);
    for (const fieldname in extendingFields) {
        abstractFields[fieldname] = extendingFields[fieldname];
    }
    combined.fields = getListFromMap(abstractFields);
    return combined;
}
export function getAbstractCombinedSchemas(schemas) {
    const abstractSchemaNames = Object.keys(schemas).filter((n) => schemas[n].isAbstract);
    const extendingSchemaNames = Object.keys(schemas).filter((n) => abstractSchemaNames.includes(schemas[n].extends ?? ''));
    const completeSchemas = Object.keys(schemas)
        .filter((n) => !abstractSchemaNames.includes(n) && !extendingSchemaNames.includes(n))
        .map((n) => schemas[n]);
    const schemaMap = getMapFromList(completeSchemas, 'name');
    for (const name of extendingSchemaNames) {
        const extendingSchema = schemas[name];
        const abstractSchema = schemas[extendingSchema.extends];
        schemaMap[name] = getCombined(extendingSchema, abstractSchema);
    }
    abstractSchemaNames.forEach((name) => {
        delete schemaMap[name];
    });
    return schemaMap;
}
export function getRegionalCombinedSchemas(appSchemaMap, regionalSchemaMap) {
    const combined = { ...appSchemaMap };
    for (const name in regionalSchemaMap) {
        const regionalSchema = regionalSchemaMap[name];
        if (!combined.hasOwnProperty(name)) {
            combined[name] = regionalSchema;
            continue;
        }
        combined[name] = getCombined(regionalSchema, combined[name]);
    }
    return combined;
}
function getRegionalSchemaMap(countryCode) {
    const countrySchemas = cloneDeep(regionalSchemas[countryCode]);
    if (countrySchemas === undefined) {
        return {};
    }
    return getMapFromList(countrySchemas, 'name');
}
function addCustomFields(schemaMap, rawCustomFields) {
    const fieldMap = getFieldMapFromRawCustomFields(rawCustomFields, schemaMap);
    for (const schemaName in fieldMap) {
        const fields = fieldMap[schemaName];
        schemaMap[schemaName]?.fields.push(...fields);
    }
}
function getFieldMapFromRawCustomFields(rawCustomFields, schemaMap) {
    const schemaFieldMap = {};
    return rawCustomFields.reduce((map, { parent, label, fieldname, fieldtype, isRequired, section, tab, options: rawOptions, default: defaultValue, target, references, }) => {
        schemaFieldMap[parent] ?? (schemaFieldMap[parent] = getMapFromList(schemaMap[parent]?.fields ?? [], 'fieldname'));
        if (!schemaFieldMap[parent] || schemaFieldMap[parent][fieldname]) {
            return map;
        }
        map[parent] ?? (map[parent] = []);
        const options = rawOptions
            ?.split('\n')
            .map((o) => {
            const value = o.trim();
            return { value, label: value };
        })
            .filter((o) => o.label && o.value);
        const field = {
            label,
            fieldname,
            fieldtype,
            section,
            tab,
            isCustom: true,
        };
        if (options?.length) {
            field.options = options;
        }
        if (typeof isRequired === 'number' || typeof isRequired === 'boolean') {
            field.required = Boolean(isRequired);
        }
        if (typeof target === 'string') {
            field.target = target;
        }
        if (typeof references === 'string') {
            field.references = references;
        }
        if (field.required && defaultValue != null) {
            field.default = defaultValue;
        }
        if (field.required && field.default == null) {
            field.required = false;
        }
        map[parent].push(field);
        return map;
    }, {});
}
//# sourceMappingURL=index.js.map