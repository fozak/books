import { t } from 'fyo';
import { ModelNameEnum } from 'models/types';
import { Report } from 'reports/Report';
import { safeParseFloat, safeParseInt } from 'utils/index';
import getCommonExportActions from './commonExporter';
export class LedgerReport extends Report {
    constructor(fyo) {
        super(fyo);
        this._rawData = [];
        this.shouldRefresh = false;
        this._setObservers();
    }
    _setObservers() {
        const listener = () => (this.shouldRefresh = true);
        this.fyo.doc.observer.on(`sync:${ModelNameEnum.AccountingLedgerEntry}`, listener);
        this.fyo.doc.observer.on(`delete:${ModelNameEnum.AccountingLedgerEntry}`, listener);
    }
    _getGroupByKey() {
        let groupBy = 'referenceName';
        if (this.groupBy && this.groupBy !== 'none') {
            groupBy = this.groupBy;
        }
        return groupBy;
    }
    _getGroupedMap(sort, groupBy) {
        groupBy ?? (groupBy = this._getGroupByKey());
        /**
         * Sort rows by ascending or descending
         */
        if (sort) {
            this._rawData.sort((a, b) => {
                if (this.ascending) {
                    return +a.date - +b.date;
                }
                return +b.date - +a.date;
            });
        }
        /**
         * Map remembers the order of insertion
         * ∴ presorting maintains grouping order
         */
        const map = new Map();
        for (const entry of this._rawData) {
            const groupingKey = entry[groupBy];
            if (!map.has(groupingKey)) {
                map.set(groupingKey, []);
            }
            map.get(groupingKey).push(entry);
        }
        return map;
    }
    async _setRawData() {
        const fields = [
            'name',
            'account',
            'date',
            'debit',
            'credit',
            'referenceType',
            'referenceName',
            'party',
            'reverted',
            'reverts',
        ];
        const filters = await this._getQueryFilters();
        const entries = (await this.fyo.db.getAllRaw(ModelNameEnum.AccountingLedgerEntry, {
            fields,
            filters,
            orderBy: ['date', 'created'],
            order: this.ascending ? 'asc' : 'desc',
        }));
        this._rawData = entries.map((entry) => {
            return {
                name: safeParseInt(entry.name),
                account: entry.account,
                date: new Date(entry.date),
                debit: Math.abs(safeParseFloat(entry.debit)),
                credit: Math.abs(safeParseFloat(entry.credit)),
                balance: 0,
                referenceType: entry.referenceType,
                referenceName: entry.referenceName,
                party: entry.party,
                reverted: Boolean(entry.reverted),
                reverts: entry.reverts,
            };
        });
    }
    getActions() {
        return getCommonExportActions(this);
    }
}
LedgerReport.title = t `General Ledger`;
LedgerReport.reportName = 'general-ledger';
//# sourceMappingURL=LedgerReport.js.map