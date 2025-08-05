import { constants } from 'fs';
import fs from 'fs/promises';
import config from 'utils/config';
import { IPC_CHANNELS } from 'utils/messages';
export async function setAndGetCleanedConfigFiles() {
    const files = config.get('files', []);
    const cleanedFileMap = new Map();
    for (const file of files) {
        const exists = await fs
            .access(file.dbPath, constants.W_OK)
            .then(() => true)
            .catch(() => false);
        if (!file.companyName) {
            continue;
        }
        const key = `${file.companyName}-${file.dbPath}`;
        if (!exists || cleanedFileMap.has(key)) {
            continue;
        }
        cleanedFileMap.set(key, file);
    }
    const cleanedFiles = Array.from(cleanedFileMap.values());
    config.set('files', cleanedFiles);
    return cleanedFiles;
}
export async function getConfigFilesWithModified(files) {
    const filesWithModified = [];
    for (const { dbPath, id, companyName, openCount } of files) {
        const { mtime } = await fs.stat(dbPath);
        filesWithModified.push({
            id,
            dbPath,
            companyName,
            modified: mtime.toISOString(),
            openCount,
        });
    }
    return filesWithModified;
}
export async function getErrorHandledReponse(func) {
    const response = {};
    try {
        response.data = await func();
    }
    catch (err) {
        response.error = {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
        };
    }
    return response;
}
export function rendererLog(main, ...args) {
    main.mainWindow?.webContents.send(IPC_CHANNELS.CONSOLE_LOG, ...args);
}
export function isNetworkError(error) {
    switch (error?.message) {
        case 'net::ERR_INTERNET_DISCONNECTED':
        case 'net::ERR_NETWORK_CHANGED':
        case 'net::ERR_PROXY_CONNECTION_FAILED':
        case 'net::ERR_CONNECTION_RESET':
        case 'net::ERR_CONNECTION_CLOSE':
        case 'net::ERR_NAME_NOT_RESOLVED':
        case 'net::ERR_TIMED_OUT':
        case 'net::ERR_CONNECTION_TIMED_OUT':
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=helpers.js.map