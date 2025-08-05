import { Converter } from 'fyo/core/converter';
import Observable from 'fyo/utils/observable';
import { getIsNullOrUndef } from 'utils';
export class Report extends Observable {
    constructor(fyo) {
        super();
        this.columns = [];
        this.filters = [];
        this.usePagination = false;
        this.shouldRefresh = false;
        this.fyo = fyo;
        this.reportData = [];
    }
    get title() {
        return this.constructor.title;
    }
    get reportName() {
        return this.constructor.reportName;
    }
    async initialize() {
        /**
         * Not in constructor cause possibly async.
         */
        await this.setDefaultFilters();
        this.filters = await this.getFilters();
        this.columns = await this.getColumns();
        await this.setReportData();
    }
    get filterMap() {
        const filterMap = {};
        for (const { fieldname } of this.filters) {
            const value = this.get(fieldname);
            if (getIsNullOrUndef(value)) {
                continue;
            }
            filterMap[fieldname] = value;
        }
        return filterMap;
    }
    async set(key, value, callPostSet = true) {
        const field = this.filters.find((f) => f.fieldname === key);
        if (field === undefined) {
            return;
        }
        value = Converter.toRawValue(value, field, this.fyo);
        const prevValue = this[key];
        if (prevValue === value) {
            return;
        }
        if (getIsNullOrUndef(value)) {
            delete this[key];
        }
        else {
            this[key] = value;
        }
        if (callPostSet) {
            await this.updateData(key);
        }
    }
    async updateData(key, force) {
        await this.setDefaultFilters();
        this.filters = await this.getFilters();
        this.columns = await this.getColumns();
        await this.setReportData(key, force);
    }
}
Report.isInventory = false;
//# sourceMappingURL=Report.js.map