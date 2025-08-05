var _Converter_instances, _Converter_toDocValueMap, _Converter_toRawValueMap;
import { __classPrivateFieldGet } from "tslib";
import { Doc } from 'fyo/model/doc';
import { isPesa } from 'fyo/utils';
import { ValueError } from 'fyo/utils/errors';
import { DateTime } from 'luxon';
import { FieldTypeEnum } from 'schemas/types';
import { getIsNullOrUndef, safeParseFloat, safeParseInt } from 'utils';
/**
 * # Converter
 *
 * Basically converts serializable RawValues from the db to DocValues used
 * by the frontend and vice versa.
 *
 * ## Value Conversion
 * It exposes two static methods: `toRawValue` and `toDocValue` that can be
 * used elsewhere given the fieldtype.
 *
 * ## Map Conversion
 * Two methods `toDocValueMap` and `toRawValueMap` are exposed but should be
 * used only from the `dbHandler`.
 */
export class Converter {
    constructor(db, fyo) {
        _Converter_instances.add(this);
        this.db = db;
        this.fyo = fyo;
    }
    toDocValueMap(schemaName, rawValueMap) {
        rawValueMap ?? (rawValueMap = {});
        if (Array.isArray(rawValueMap)) {
            return rawValueMap.map((dv) => __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toDocValueMap).call(this, schemaName, dv));
        }
        else {
            return __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toDocValueMap).call(this, schemaName, rawValueMap);
        }
    }
    toRawValueMap(schemaName, docValueMap) {
        docValueMap ?? (docValueMap = {});
        if (Array.isArray(docValueMap)) {
            return docValueMap.map((dv) => __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toRawValueMap).call(this, schemaName, dv));
        }
        else {
            return __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toRawValueMap).call(this, schemaName, docValueMap);
        }
    }
    static toDocValue(value, field, fyo) {
        switch (field.fieldtype) {
            case FieldTypeEnum.Currency:
                return toDocCurrency(value, field, fyo);
            case FieldTypeEnum.Date:
                return toDocDate(value, field);
            case FieldTypeEnum.Datetime:
                return toDocDate(value, field);
            case FieldTypeEnum.Int:
                return toDocInt(value, field);
            case FieldTypeEnum.Float:
                return toDocFloat(value, field);
            case FieldTypeEnum.Check:
                return toDocCheck(value, field);
            case FieldTypeEnum.Attachment:
                return toDocAttachment(value, field);
            default:
                return toDocString(value, field);
        }
    }
    static toRawValue(value, field, fyo) {
        switch (field.fieldtype) {
            case FieldTypeEnum.Currency:
                return toRawCurrency(value, fyo, field);
            case FieldTypeEnum.Date:
                return toRawDate(value, field);
            case FieldTypeEnum.Datetime:
                return toRawDateTime(value, field);
            case FieldTypeEnum.Int:
                return toRawInt(value, field);
            case FieldTypeEnum.Float:
                return toRawFloat(value, field);
            case FieldTypeEnum.Check:
                return toRawCheck(value, field);
            case FieldTypeEnum.Link:
                return toRawLink(value, field);
            case FieldTypeEnum.Attachment:
                return toRawAttachment(value, field);
            default:
                return toRawString(value, field);
        }
    }
}
_Converter_instances = new WeakSet(), _Converter_toDocValueMap = function _Converter_toDocValueMap(schemaName, rawValueMap) {
    const fieldValueMap = this.db.fieldMap[schemaName];
    const docValueMap = {};
    for (const fieldname in rawValueMap) {
        const field = fieldValueMap[fieldname];
        const rawValue = rawValueMap[fieldname];
        if (!field) {
            continue;
        }
        if (Array.isArray(rawValue)) {
            const parentSchemaName = field.target;
            docValueMap[fieldname] = rawValue.map((rv) => __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toDocValueMap).call(this, parentSchemaName, rv));
        }
        else {
            docValueMap[fieldname] = Converter.toDocValue(rawValue, field, this.fyo);
        }
    }
    return docValueMap;
}, _Converter_toRawValueMap = function _Converter_toRawValueMap(schemaName, docValueMap) {
    const fieldValueMap = this.db.fieldMap[schemaName];
    const rawValueMap = {};
    for (const fieldname in docValueMap) {
        const field = fieldValueMap[fieldname];
        const docValue = docValueMap[fieldname];
        if (Array.isArray(docValue)) {
            const parentSchemaName = field.target;
            rawValueMap[fieldname] = docValue.map((value) => {
                if (value instanceof Doc) {
                    return __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toRawValueMap).call(this, parentSchemaName, value.getValidDict());
                }
                return __classPrivateFieldGet(this, _Converter_instances, "m", _Converter_toRawValueMap).call(this, parentSchemaName, value);
            });
        }
        else {
            rawValueMap[fieldname] = Converter.toRawValue(docValue, field, this.fyo);
        }
    }
    return rawValueMap;
};
function toDocString(value, field) {
    if (value === null) {
        return null;
    }
    if (value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    throwError(value, field, 'doc');
}
function toDocDate(value, field) {
    if (value instanceof Date) {
        return value;
    }
    if (value === null || value === '') {
        return null;
    }
    if (typeof value !== 'string') {
        throwError(value, field, 'doc');
    }
    const date = DateTime.fromISO(value).toJSDate();
    if (date.toString() === 'Invalid Date') {
        throwError(value, field, 'doc');
    }
    return date;
}
function toDocCurrency(value, field, fyo) {
    if (isPesa(value)) {
        return value;
    }
    if (value === '') {
        return fyo.pesa(0);
    }
    if (typeof value === 'string') {
        return fyo.pesa(value);
    }
    if (typeof value === 'number') {
        return fyo.pesa(value);
    }
    if (typeof value === 'boolean') {
        return fyo.pesa(Number(value));
    }
    if (value === null) {
        return fyo.pesa(0);
    }
    throwError(value, field, 'doc');
}
function toDocInt(value, field) {
    if (value === '') {
        return 0;
    }
    if (typeof value === 'string') {
        value = safeParseInt(value);
    }
    return toDocFloat(value, field);
}
function toDocFloat(value, field) {
    if (value === '') {
        return 0;
    }
    if (typeof value === 'boolean') {
        return Number(value);
    }
    if (typeof value === 'string') {
        value = safeParseFloat(value);
    }
    if (value === null) {
        value = 0;
    }
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    throwError(value, field, 'doc');
}
function toDocCheck(value, field) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return !!safeParseFloat(value);
    }
    if (typeof value === 'number') {
        return Boolean(value);
    }
    throwError(value, field, 'doc');
}
function toDocAttachment(value, field) {
    if (!value) {
        return null;
    }
    if (typeof value !== 'string') {
        throwError(value, field, 'doc');
    }
    try {
        return JSON.parse(value) || null;
    }
    catch {
        throwError(value, field, 'doc');
    }
}
function toRawCurrency(value, fyo, field) {
    if (isPesa(value)) {
        return value.store;
    }
    if (getIsNullOrUndef(value)) {
        return fyo.pesa(0).store;
    }
    if (typeof value === 'number') {
        return fyo.pesa(value).store;
    }
    if (typeof value === 'string') {
        return fyo.pesa(value).store;
    }
    throwError(value, field, 'raw');
}
function toRawInt(value, field) {
    if (typeof value === 'string') {
        return safeParseInt(value);
    }
    if (getIsNullOrUndef(value)) {
        return 0;
    }
    if (typeof value === 'number') {
        return Math.floor(value);
    }
    throwError(value, field, 'raw');
}
function toRawFloat(value, field) {
    if (typeof value === 'string') {
        return safeParseFloat(value);
    }
    if (getIsNullOrUndef(value)) {
        return 0;
    }
    if (typeof value === 'number') {
        return value;
    }
    throwError(value, field, 'raw');
}
function toRawDate(value, field) {
    if (value === null) {
        return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        value = new Date(value);
    }
    if (value instanceof Date) {
        return DateTime.fromJSDate(value).toISODate();
    }
    if (value instanceof DateTime) {
        return value.toISODate();
    }
    throwError(value, field, 'raw');
}
function toRawDateTime(value, field) {
    if (value === null) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (value instanceof DateTime) {
        return value.toJSDate().toISOString();
    }
    throwError(value, field, 'raw');
}
function toRawCheck(value, field) {
    if (typeof value === 'number') {
        value = Boolean(value);
    }
    if (typeof value === 'boolean') {
        return Number(value);
    }
    throwError(value, field, 'raw');
}
function toRawString(value, field) {
    if (value === null) {
        return null;
    }
    if (value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    throwError(value, field, 'raw');
}
function toRawLink(value, field) {
    if (value === null || !value?.length) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    throwError(value, field, 'raw');
}
function toRawAttachment(value, field) {
    if (!value) {
        return null;
    }
    if (value?.name &&
        value?.data &&
        value?.type) {
        return JSON.stringify(value);
    }
    throwError(value, field, 'raw');
}
function throwError(value, field, type) {
    throw new ValueError(`invalid ${type} conversion '${String(value)}' of type ${typeof value} found, field: ${JSON.stringify(field)}`);
}
//# sourceMappingURL=converter.js.map