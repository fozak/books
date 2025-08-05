import { app, dialog, ipcMain, } from 'electron';
import { autoUpdater } from 'electron-updater';
import { constants } from 'fs';
import fs from 'fs-extra';
import path from 'path';
import databaseManager from '../backend/database/manager';
import { emitMainProcessError } from '../backend/helpers';
import { IPC_ACTIONS } from '../utils/messages';
import { getUrlAndTokenString, sendError } from './contactMothership';
import { getLanguageMap } from './getLanguageMap';
import { getTemplates } from './getPrintTemplates';
import { printHtmlDocument } from './printHtmlDocument';
import { getConfigFilesWithModified, getErrorHandledReponse, isNetworkError, setAndGetCleanedConfigFiles, } from './helpers';
import { saveHtmlAsPdf } from './saveHtmlAsPdf';
import { sendAPIRequest } from './api';
import { initScheduler } from './initSheduler';
export default function registerIpcMainActionListeners(main) {
    ipcMain.handle(IPC_ACTIONS.CHECK_DB_ACCESS, async (_, filePath) => {
        try {
            await fs.access(filePath, constants.W_OK | constants.R_OK);
        }
        catch (err) {
            return false;
        }
        return true;
    });
    ipcMain.handle(IPC_ACTIONS.GET_DB_DEFAULT_PATH, async (_, companyName) => {
        let root;
        try {
            root = app.getPath('documents');
        }
        catch {
            root = app.getPath('userData');
        }
        if (main.isDevelopment) {
            root = 'dbs';
        }
        const dbsPath = path.join(root, 'Frappe Books');
        const backupPath = path.join(dbsPath, 'backups');
        await fs.ensureDir(backupPath);
        let dbFilePath = path.join(dbsPath, `${companyName}.books.db`);
        if (await fs.pathExists(dbFilePath)) {
            const option = await dialog.showMessageBox({
                type: 'question',
                title: 'File Exists',
                message: `Filename already exists. Do you want to overwrite the existing file or create a new one?`,
                buttons: ['Overwrite', 'New'],
            });
            if (option.response === 1) {
                const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
                dbFilePath = path.join(dbsPath, `${companyName}_${timestamp}.books.db`);
                await dialog.showMessageBox({
                    type: 'info',
                    message: `New file: ${path.basename(dbFilePath)}`,
                });
            }
        }
        return dbFilePath;
    });
    ipcMain.handle(IPC_ACTIONS.GET_OPEN_FILEPATH, async (_, options) => {
        return await dialog.showOpenDialog(main.mainWindow, options);
    });
    ipcMain.handle(IPC_ACTIONS.GET_SAVE_FILEPATH, async (_, options) => {
        return await dialog.showSaveDialog(main.mainWindow, options);
    });
    ipcMain.handle(IPC_ACTIONS.GET_DIALOG_RESPONSE, async (_, options) => {
        if (main.isDevelopment || main.isLinux) {
            Object.assign(options, { icon: main.icon });
        }
        return await dialog.showMessageBox(main.mainWindow, options);
    });
    ipcMain.handle(IPC_ACTIONS.SHOW_ERROR, (_, { title, content }) => {
        return dialog.showErrorBox(title, content);
    });
    ipcMain.handle(IPC_ACTIONS.SAVE_HTML_AS_PDF, async (_, html, savePath, width, height) => {
        return await saveHtmlAsPdf(html, savePath, app, width, height);
    });
    ipcMain.handle(IPC_ACTIONS.PRINT_HTML_DOCUMENT, async (_, html, width, height) => {
        return await printHtmlDocument(html, app, width, height);
    });
    ipcMain.handle(IPC_ACTIONS.SAVE_DATA, async (_, data, savePath) => {
        return await fs.writeFile(savePath, data, { encoding: 'utf-8' });
    });
    ipcMain.handle(IPC_ACTIONS.SEND_ERROR, async (_, bodyJson) => {
        await sendError(bodyJson, main);
    });
    ipcMain.handle(IPC_ACTIONS.CHECK_FOR_UPDATES, async () => {
        if (main.isDevelopment || main.checkedForUpdate) {
            return;
        }
        try {
            await autoUpdater.checkForUpdates();
        }
        catch (error) {
            if (isNetworkError(error)) {
                return;
            }
            emitMainProcessError(error);
        }
        main.checkedForUpdate = true;
    });
    ipcMain.handle(IPC_ACTIONS.GET_LANGUAGE_MAP, async (_, code) => {
        const obj = { languageMap: {}, success: true, message: '' };
        try {
            obj.languageMap = await getLanguageMap(code);
        }
        catch (err) {
            obj.success = false;
            obj.message = err.message;
        }
        return obj;
    });
    ipcMain.handle(IPC_ACTIONS.SELECT_FILE, async (_, options) => {
        const response = {
            name: '',
            filePath: '',
            success: false,
            data: Buffer.from('', 'utf-8'),
            canceled: false,
        };
        const { filePaths, canceled } = await dialog.showOpenDialog(main.mainWindow, { ...options, properties: ['openFile'] });
        response.filePath = filePaths?.[0];
        response.canceled = canceled;
        if (!response.filePath) {
            return response;
        }
        response.success = true;
        if (canceled) {
            return response;
        }
        response.name = path.basename(response.filePath);
        response.data = await fs.readFile(response.filePath);
        return response;
    });
    ipcMain.handle(IPC_ACTIONS.GET_CREDS, () => {
        return getUrlAndTokenString();
    });
    ipcMain.handle(IPC_ACTIONS.DELETE_FILE, async (_, filePath) => {
        return getErrorHandledReponse(async () => await fs.unlink(filePath));
    });
    ipcMain.handle(IPC_ACTIONS.GET_DB_LIST, async () => {
        const files = await setAndGetCleanedConfigFiles();
        return await getConfigFilesWithModified(files);
    });
    ipcMain.handle(IPC_ACTIONS.GET_ENV, async () => {
        let version = app.getVersion();
        if (main.isDevelopment) {
            const packageJson = await fs.readFile('package.json', 'utf-8');
            version = JSON.parse(packageJson).version;
        }
        return {
            isDevelopment: main.isDevelopment,
            platform: process.platform,
            version,
        };
    });
    ipcMain.handle(IPC_ACTIONS.GET_TEMPLATES, async (_, posPrintWidth) => {
        return getTemplates(posPrintWidth);
    });
    ipcMain.handle(IPC_ACTIONS.INIT_SHEDULER, async (_, interval) => {
        return initScheduler(interval);
    });
    ipcMain.handle(IPC_ACTIONS.SEND_API_REQUEST, async (e, endpoint, options) => {
        return sendAPIRequest(endpoint, options);
    });
    /**
     * Database Related Actions
     */
    ipcMain.handle(IPC_ACTIONS.DB_CREATE, async (_, dbPath, countryCode) => {
        return await getErrorHandledReponse(async () => {
            return await databaseManager.createNewDatabase(dbPath, countryCode);
        });
    });
    ipcMain.handle(IPC_ACTIONS.DB_CONNECT, async (_, dbPath, countryCode) => {
        return await getErrorHandledReponse(async () => {
            return await databaseManager.connectToDatabase(dbPath, countryCode);
        });
    });
    ipcMain.handle(IPC_ACTIONS.DB_CALL, async (_, method, ...args) => {
        return await getErrorHandledReponse(async () => {
            return await databaseManager.call(method, ...args);
        });
    });
    ipcMain.handle(IPC_ACTIONS.DB_BESPOKE, async (_, method, ...args) => {
        return await getErrorHandledReponse(async () => {
            return await databaseManager.callBespoke(method, ...args);
        });
    });
    ipcMain.handle(IPC_ACTIONS.DB_SCHEMA, async () => {
        return await getErrorHandledReponse(() => {
            return databaseManager.getSchemaMap();
        });
    });
}
//# sourceMappingURL=registerIpcMainActionListeners.js.map