import { DuplicateEntryError, NotFoundError } from 'fyo/utils/errors';
import { FieldTypeEnum, } from 'schemas/types';
export async function getDbSyncError(err, doc, fyo) {
    if (err.message.includes('UNIQUE constraint failed:')) {
        return getDuplicateEntryError(err, doc);
    }
    if (err.message.includes('FOREIGN KEY constraint failed')) {
        return getNotFoundError(err, doc, fyo);
    }
    return err;
}
function getDuplicateEntryError(err, doc) {
    const matches = err.message.match(/UNIQUE constraint failed:\s(\w+)\.(\w+)$/);
    if (!matches) {
        return err;
    }
    const schemaName = matches[1];
    const fieldname = matches[2];
    if (!schemaName || !fieldname) {
        return err;
    }
    const duplicateEntryError = new DuplicateEntryError(err.message, false);
    const validDict = doc.getValidDict(false, true);
    duplicateEntryError.stack = err.stack;
    duplicateEntryError.more = {
        schemaName,
        fieldname,
        value: validDict[fieldname],
    };
    return duplicateEntryError;
}
async function getNotFoundError(err, doc, fyo) {
    const notFoundError = new NotFoundError(fyo.t `Cannot perform operation.`);
    notFoundError.stack = err.stack;
    notFoundError.more.message = err.message;
    const details = await getNotFoundDetails(doc, fyo);
    if (!details) {
        notFoundError.shouldStore = true;
        return notFoundError;
    }
    notFoundError.shouldStore = false;
    notFoundError.message = fyo.t `${details.label} value ${details.value} does not exist.`;
    return notFoundError;
}
async function getNotFoundDetails(doc, fyo) {
    /**
     * Since 'FOREIGN KEY constraint failed' doesn't inform
     * how the operation failed, all Link and DynamicLink fields
     * must be checked for value existance so as to provide a
     * decent error message.
     */
    for (const field of doc.schema.fields) {
        const details = await getNotFoundDetailsIfDoesNotExists(field, doc, fyo);
        if (details) {
            return details;
        }
    }
    return null;
}
async function getNotFoundDetailsIfDoesNotExists(field, doc, fyo) {
    const value = doc.get(field.fieldname);
    if (field.fieldtype === FieldTypeEnum.Link && value) {
        return getNotFoundLinkDetails(field, value, fyo);
    }
    if (field.fieldtype === FieldTypeEnum.DynamicLink && value) {
        return getNotFoundDynamicLinkDetails(field, value, fyo, doc);
    }
    if (field.fieldtype === FieldTypeEnum.Table &&
        value?.length) {
        return await getNotFoundTableDetails(value, fyo);
    }
    return null;
}
async function getNotFoundLinkDetails(field, value, fyo) {
    const { target } = field;
    const exists = await fyo.db.exists(target, value);
    if (!exists) {
        return { label: field.label, value };
    }
    return null;
}
async function getNotFoundDynamicLinkDetails(field, value, fyo, doc) {
    const { references } = field;
    const target = doc.get(references);
    if (!target) {
        return null;
    }
    const exists = await fyo.db.exists(target, value);
    if (!exists) {
        return { label: field.label, value };
    }
    return null;
}
async function getNotFoundTableDetails(value, fyo) {
    for (const childDoc of value) {
        const details = await getNotFoundDetails(childDoc, fyo);
        if (details) {
            return details;
        }
    }
    return null;
}
//# sourceMappingURL=errorHelpers.js.map