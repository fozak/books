/**
 * The types in this file will be used by the main db class (core.ts) in the
 * backend process and the the frontend db class (dbHandler.ts).
 *
 * DatabaseBase is an abstract class so that the function signatures
 * match on both ends i.e. DatabaseCore and DatabaseHandler.
 */
export class DatabaseBase {
}
/**
 * DatabaseDemuxBase is an abstract class that ensures that the function signatures
 * match between the DatabaseManager and the DatabaseDemux.
 *
 * This allows testing the frontend code while directly plugging in the DatabaseManager
 * and bypassing all the API and IPC calls.
 */
export class DatabaseDemuxBase {
}
//# sourceMappingURL=types.js.map