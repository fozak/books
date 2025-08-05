import { contextBridge, ipcRenderer } from 'electron';
import config from 'utils/config';
import { IPC_ACTIONS, IPC_CHANNELS, IPC_MESSAGES } from 'utils/messages';
const ipc = {
    desktop: true,
    reloadWindow() {
        return ipcRenderer.send(IPC_MESSAGES.RELOAD_MAIN_WINDOW);
    },
    minimizeWindow() {
        return ipcRenderer.send(IPC_MESSAGES.MINIMIZE_MAIN_WINDOW);
    },
    toggleMaximize() {
        return ipcRenderer.send(IPC_MESSAGES.MAXIMIZE_MAIN_WINDOW);
    },
    isMaximized() {
        return new Promise((resolve) => {
            ipcRenderer.send(IPC_MESSAGES.ISMAXIMIZED_MAIN_WINDOW);
            ipcRenderer.once(IPC_MESSAGES.ISMAXIMIZED_RESULT, (_event, isMaximized) => {
                resolve(isMaximized);
            });
        });
    },
    isFullscreen() {
        return new Promise((resolve) => {
            ipcRenderer.send(IPC_MESSAGES.ISFULLSCREEN_MAIN_WINDOW);
            ipcRenderer.once(IPC_MESSAGES.ISFULLSCREEN_RESULT, (_event, isFullscreen) => {
                resolve(isFullscreen);
            });
        });
    },
    closeWindow() {
        return ipcRenderer.send(IPC_MESSAGES.CLOSE_MAIN_WINDOW);
    },
    async getCreds() {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_CREDS));
    },
    async getLanguageMap(code) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_LANGUAGE_MAP, code));
    },
    async getTemplates(posTemplateWidth) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_TEMPLATES, posTemplateWidth));
    },
    async initScheduler(time) {
        await ipcRenderer.invoke(IPC_ACTIONS.INIT_SHEDULER, time);
    },
    async selectFile(options) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.SELECT_FILE, options));
    },
    async getSaveFilePath(options) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_SAVE_FILEPATH, options));
    },
    async getOpenFilePath(options) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_OPEN_FILEPATH, options));
    },
    async checkDbAccess(filePath) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.CHECK_DB_ACCESS, filePath));
    },
    async checkForUpdates() {
        await ipcRenderer.invoke(IPC_ACTIONS.CHECK_FOR_UPDATES);
    },
    openLink(link) {
        ipcRenderer.send(IPC_MESSAGES.OPEN_EXTERNAL, link);
    },
    async deleteFile(filePath) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.DELETE_FILE, filePath));
    },
    async saveData(data, savePath) {
        await ipcRenderer.invoke(IPC_ACTIONS.SAVE_DATA, data, savePath);
    },
    showItemInFolder(filePath) {
        ipcRenderer.send(IPC_MESSAGES.SHOW_ITEM_IN_FOLDER, filePath);
    },
    async makePDF(html, savePath, width, height) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.SAVE_HTML_AS_PDF, html, savePath, width, height));
    },
    async printDocument(html, width, height) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.PRINT_HTML_DOCUMENT, html, width, height));
    },
    async getDbList() {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_DB_LIST));
    },
    async getDbDefaultPath(companyName) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_DB_DEFAULT_PATH, companyName));
    },
    async getEnv() {
        return (await ipcRenderer.invoke(IPC_ACTIONS.GET_ENV));
    },
    openExternalUrl(url) {
        ipcRenderer.send(IPC_MESSAGES.OPEN_EXTERNAL, url);
    },
    async showError(title, content) {
        await ipcRenderer.invoke(IPC_ACTIONS.SHOW_ERROR, { title, content });
    },
    async sendError(body) {
        await ipcRenderer.invoke(IPC_ACTIONS.SEND_ERROR, body);
    },
    async sendAPIRequest(endpoint, options) {
        return (await ipcRenderer.invoke(IPC_ACTIONS.SEND_API_REQUEST, endpoint, options));
    },
    registerMainProcessErrorListener(listener) {
        ipcRenderer.on(IPC_CHANNELS.LOG_MAIN_PROCESS_ERROR, listener);
    },
    registerTriggerFrontendActionListener(listener) {
        ipcRenderer.on(IPC_CHANNELS.TRIGGER_ERPNEXT_SYNC, listener);
    },
    registerConsoleLogListener(listener) {
        ipcRenderer.on(IPC_CHANNELS.CONSOLE_LOG, listener);
    },
    db: {
        async getSchema() {
            return (await ipcRenderer.invoke(IPC_ACTIONS.DB_SCHEMA));
        },
        async create(dbPath, countryCode) {
            return (await ipcRenderer.invoke(IPC_ACTIONS.DB_CREATE, dbPath, countryCode));
        },
        async connect(dbPath, countryCode) {
            return (await ipcRenderer.invoke(IPC_ACTIONS.DB_CONNECT, dbPath, countryCode));
        },
        async call(method, ...args) {
            return (await ipcRenderer.invoke(IPC_ACTIONS.DB_CALL, method, ...args));
        },
        async bespoke(method, ...args) {
            return (await ipcRenderer.invoke(IPC_ACTIONS.DB_BESPOKE, method, ...args));
        },
    },
    store: {
        get(key) {
            return config.get(key);
        },
        set(key, value) {
            return config.set(key, value);
        },
        delete(key) {
            return config.delete(key);
        },
    },
};
contextBridge.exposeInMainWorld('ipc', ipc);
//# sourceMappingURL=preload.js.map