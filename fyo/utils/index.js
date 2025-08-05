import { Money } from 'pesa';
import { getIsNullOrUndef, safeParseInt } from 'utils';
export function slug(str) {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
        return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
    })
        .replace(/\s+/g, '');
}
export function unique(list, key = (it) => String(it)) {
    const seen = {};
    return list.filter((item) => {
        const k = key(item);
        return seen.hasOwnProperty(k) ? false : (seen[k] = true);
    });
}
export function getDuplicates(array) {
    const duplicates = [];
    for (let i = 0; i < array.length; i++) {
        const previous = array[safeParseInt(i) - 1];
        const current = array[i];
        if (current === previous) {
            if (!duplicates.includes(current)) {
                duplicates.push(current);
            }
        }
    }
    return duplicates;
}
export function isPesa(value) {
    return value instanceof Money;
}
export function isFalsy(value) {
    if (!value) {
        return true;
    }
    if (isPesa(value) && value.isZero()) {
        return true;
    }
    if (Array.isArray(value) && value.length === 0) {
        return true;
    }
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return true;
    }
    return false;
}
export function getActions(doc) {
    const Model = doc.fyo.models[doc.schemaName];
    if (Model === undefined) {
        return [];
    }
    return Model.getActions(doc.fyo);
}
export async function getSingleValue(fieldname, parent, fyo) {
    if (!fyo.db.isConnected) {
        return undefined;
    }
    const res = await fyo.db.getSingleValues({ fieldname, parent });
    const singleValue = res.find((f) => f.fieldname === fieldname && f.parent === parent);
    if (singleValue === undefined) {
        return undefined;
    }
    return singleValue.value;
}
export function getOptionList(field, doc) {
    const list = getRawOptionList(field, doc);
    return list.map((option) => {
        if (typeof option === 'string') {
            return {
                label: option,
                value: option,
            };
        }
        return option;
    });
}
function getRawOptionList(field, doc) {
    const options = field.options;
    if (options && options.length > 0) {
        return field.options;
    }
    if (getIsNullOrUndef(doc)) {
        return [];
    }
    const Model = doc.fyo.models[doc.schemaName];
    if (Model === undefined) {
        return [];
    }
    const getList = Model.lists[field.fieldname];
    if (getList === undefined) {
        return [];
    }
    return getList(doc);
}
export function getEmptyValuesByFieldTypes(fieldtype, fyo) {
    switch (fieldtype) {
        case 'Date':
        case 'Datetime':
            return new Date();
        case 'Float':
        case 'Int':
            return 0;
        case 'Currency':
            return fyo.pesa(0);
        case 'Check':
            return false;
        case 'DynamicLink':
        case 'Link':
        case 'Select':
        case 'AutoComplete':
        case 'Text':
        case 'Data':
        case 'Color':
            return null;
        case 'Table':
        case 'Attachment':
        case 'AttachImage':
        default:
            return null;
    }
}
//# sourceMappingURL=index.js.map