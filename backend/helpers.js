import { constants } from 'fs';
import fs from 'fs/promises';
import { CUSTOM_EVENTS } from 'utils/messages';
export const sqliteTypeMap = {
    AutoComplete: 'text',
    Currency: 'text',
    Int: 'integer',
    Float: 'float',
    Percent: 'float',
    Check: 'boolean',
    Code: 'text',
    Date: 'date',
    Datetime: 'datetime',
    Time: 'time',
    Text: 'text',
    Data: 'text',
    Secret: 'text',
    Link: 'text',
    DynamicLink: 'text',
    Password: 'text',
    Select: 'text',
    Attachment: 'text',
    AttachImage: 'text',
    Color: 'text',
};
export const SYSTEM = '__SYSTEM__';
export const validTypes = Object.keys(sqliteTypeMap);
export function getDefaultMetaFieldValueMap() {
    const now = new Date().toISOString();
    return {
        createdBy: SYSTEM,
        modifiedBy: SYSTEM,
        created: now,
        modified: now,
    };
}
export const databaseMethodSet = new Set([
    'insert',
    'get',
    'getAll',
    'getSingleValues',
    'rename',
    'update',
    'delete',
    'deleteAll',
    'close',
    'exists',
]);
export function emitMainProcessError(error, more) {
    process.emit(CUSTOM_EVENTS.MAIN_PROCESS_ERROR, error, more);
}
export async function checkFileAccess(filePath, mode) {
    mode ?? (mode = constants.W_OK);
    return await fs
        .access(filePath, mode)
        .then(() => true)
        .catch(() => false);
}
export async function unlinkIfExists(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }
    const exists = await checkFileAccess(filePath);
    if (exists) {
        await fs.unlink(filePath);
        return true;
    }
    return false;
}
//# sourceMappingURL=helpers.js.map