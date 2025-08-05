export class Config {
    constructor(isElectron) {
        this.config = new Map();
        if (isElectron) {
            this.config = ipc.store;
        }
    }
    get(key, defaultValue) {
        const value = this.config.get(key);
        return value ?? defaultValue;
    }
    set(key, value) {
        this.config.set(key, value);
    }
    delete(key) {
        this.config.delete(key);
    }
}
//# sourceMappingURL=config.js.map