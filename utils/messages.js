// ipcRenderer.send(...)
export var IPC_MESSAGES;
(function (IPC_MESSAGES) {
    IPC_MESSAGES["OPEN_MENU"] = "open-menu";
    IPC_MESSAGES["OPEN_SETTINGS"] = "open-settings";
    IPC_MESSAGES["OPEN_EXTERNAL"] = "open-external";
    IPC_MESSAGES["SHOW_ITEM_IN_FOLDER"] = "show-item-in-folder";
    IPC_MESSAGES["RELOAD_MAIN_WINDOW"] = "reload-main-window";
    IPC_MESSAGES["MINIMIZE_MAIN_WINDOW"] = "minimize-main-window";
    IPC_MESSAGES["MAXIMIZE_MAIN_WINDOW"] = "maximize-main-window";
    IPC_MESSAGES["ISMAXIMIZED_MAIN_WINDOW"] = "ismaximized-main-window";
    IPC_MESSAGES["ISMAXIMIZED_RESULT"] = "ismaximized-result";
    IPC_MESSAGES["ISFULLSCREEN_MAIN_WINDOW"] = "isfullscreen-main-window";
    IPC_MESSAGES["ISFULLSCREEN_RESULT"] = "isfullscreen-result";
    IPC_MESSAGES["CLOSE_MAIN_WINDOW"] = "close-main-window";
})(IPC_MESSAGES || (IPC_MESSAGES = {}));
// ipcRenderer.invoke(...)
export var IPC_ACTIONS;
(function (IPC_ACTIONS) {
    IPC_ACTIONS["GET_OPEN_FILEPATH"] = "open-dialog";
    IPC_ACTIONS["GET_SAVE_FILEPATH"] = "save-dialog";
    IPC_ACTIONS["GET_DIALOG_RESPONSE"] = "show-message-box";
    IPC_ACTIONS["GET_ENV"] = "get-env";
    IPC_ACTIONS["SAVE_HTML_AS_PDF"] = "save-html-as-pdf";
    IPC_ACTIONS["PRINT_HTML_DOCUMENT"] = "print-html-document";
    IPC_ACTIONS["SAVE_DATA"] = "save-data";
    IPC_ACTIONS["SHOW_ERROR"] = "show-error";
    IPC_ACTIONS["SEND_ERROR"] = "send-error";
    IPC_ACTIONS["GET_LANGUAGE_MAP"] = "get-language-map";
    IPC_ACTIONS["CHECK_FOR_UPDATES"] = "check-for-updates";
    IPC_ACTIONS["CHECK_DB_ACCESS"] = "check-db-access";
    IPC_ACTIONS["SELECT_FILE"] = "select-file";
    IPC_ACTIONS["GET_CREDS"] = "get-creds";
    IPC_ACTIONS["GET_DB_LIST"] = "get-db-list";
    IPC_ACTIONS["GET_TEMPLATES"] = "get-templates";
    IPC_ACTIONS["INIT_SHEDULER"] = "init-scheduler";
    IPC_ACTIONS["DELETE_FILE"] = "delete-file";
    IPC_ACTIONS["GET_DB_DEFAULT_PATH"] = "get-db-default-path";
    IPC_ACTIONS["SEND_API_REQUEST"] = "send-api-request";
    // Database messages
    IPC_ACTIONS["DB_CREATE"] = "db-create";
    IPC_ACTIONS["DB_CONNECT"] = "db-connect";
    IPC_ACTIONS["DB_CALL"] = "db-call";
    IPC_ACTIONS["DB_BESPOKE"] = "db-bespoke";
    IPC_ACTIONS["DB_SCHEMA"] = "db-schema";
})(IPC_ACTIONS || (IPC_ACTIONS = {}));
// ipcMain.send(...)
export var IPC_CHANNELS;
(function (IPC_CHANNELS) {
    IPC_CHANNELS["TRIGGER_ERPNEXT_SYNC"] = "trigger-erpnext-sync";
    IPC_CHANNELS["LOG_MAIN_PROCESS_ERROR"] = "main-process-error";
    IPC_CHANNELS["CONSOLE_LOG"] = "console-log";
})(IPC_CHANNELS || (IPC_CHANNELS = {}));
export var DB_CONN_FAILURE;
(function (DB_CONN_FAILURE) {
    DB_CONN_FAILURE["INVALID_FILE"] = "invalid-file";
    DB_CONN_FAILURE["CANT_OPEN"] = "cant-open";
    DB_CONN_FAILURE["CANT_CONNECT"] = "cant-connect";
})(DB_CONN_FAILURE || (DB_CONN_FAILURE = {}));
// events
export var CUSTOM_EVENTS;
(function (CUSTOM_EVENTS) {
    CUSTOM_EVENTS["MAIN_PROCESS_ERROR"] = "main-process-error";
    CUSTOM_EVENTS["LOG_UNEXPECTED"] = "log-unexpected";
})(CUSTOM_EVENTS || (CUSTOM_EVENTS = {}));
//# sourceMappingURL=messages.js.map