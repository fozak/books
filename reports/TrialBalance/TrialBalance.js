import { t } from 'fyo';
import { ValueError } from 'fyo/utils/errors';
import { DateTime } from 'luxon';
import { AccountRootTypeEnum, } from 'models/baseModels/Account/types';
import { AccountReport, ACC_BAL_WIDTH, ACC_NAME_WIDTH, convertAccountRootNodesToAccountList, getFiscalEndpoints, } from 'reports/AccountReport';
export class TrialBalance extends AccountReport {
    constructor() {
        super(...arguments);
        this.hideGroupAmounts = false;
        this.loading = false;
        this._rawData = [];
    }
    get rootTypes() {
        return [
            AccountRootTypeEnum.Asset,
            AccountRootTypeEnum.Liability,
            AccountRootTypeEnum.Income,
            AccountRootTypeEnum.Expense,
            AccountRootTypeEnum.Equity,
        ];
    }
    async setReportData(filter, force) {
        this.loading = true;
        if (force || filter !== 'hideGroupAmounts') {
            await this._setRawData();
        }
        const map = this._getGroupedMap(true, 'account');
        const rangeGroupedMap = await this._getGroupedByDateRanges(map);
        const accountTree = await this._getAccountTree(rangeGroupedMap);
        const rootTypeRows = this.rootTypes
            .map((rootType) => {
            const rootNodes = this.getRootNodes(rootType, accountTree);
            const rootList = convertAccountRootNodesToAccountList(rootNodes);
            return {
                rootType,
                rootNodes,
                rows: this.getReportRowsFromAccountList(rootList),
            };
        })
            .filter((row) => !!(row.rootNodes && row.rootNodes.length));
        this.reportData = await this.getReportDataFromRows(rootTypeRows);
        this.loading = false;
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async getReportDataFromRows(rootTypeRows) {
        const reportData = rootTypeRows.reduce((reportData, r) => {
            reportData.push(...r.rows);
            reportData.push(this.getEmptyRow());
            return reportData;
        }, []);
        reportData.pop();
        return reportData;
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async _getGroupedByDateRanges(map) {
        const accountValueMap = new Map();
        for (const account of map.keys()) {
            const valueMap = new Map();
            /**
             * Set Balance for every DateRange key
             */
            for (const entry of map.get(account)) {
                const key = this._getRangeMapKey(entry);
                if (key === null) {
                    throw new ValueError(`invalid entry in trial balance ${entry.date?.toISOString() ?? ''}`);
                }
                const map = valueMap.get(key);
                const totalCredit = map?.credit ?? 0;
                const totalDebit = map?.debit ?? 0;
                valueMap.set(key, {
                    credit: totalCredit + (entry.credit ?? 0),
                    debit: totalDebit + (entry.debit ?? 0),
                });
            }
            accountValueMap.set(account, valueMap);
        }
        return accountValueMap;
    }
    async _getDateRanges() {
        if (!this.toDate || !this.fromDate) {
            await this.setDefaultFilters();
        }
        const toDate = DateTime.fromISO(this.toDate);
        const fromDate = DateTime.fromISO(this.fromDate);
        return [
            {
                fromDate: DateTime.fromISO('0001-01-01'),
                toDate: fromDate,
            },
            { fromDate, toDate },
            {
                fromDate: toDate,
                toDate: DateTime.fromISO('9999-12-31'),
            },
        ];
    }
    getRowFromAccountListNode(al) {
        const nameCell = {
            value: al.name,
            rawValue: al.name,
            align: 'left',
            width: ACC_NAME_WIDTH,
            bold: !al.level,
            indent: al.level ?? 0,
        };
        const balanceCells = this._dateRanges.map((k) => {
            const map = al.valueMap?.get(k);
            const hide = this.hideGroupAmounts && al.isGroup;
            return [
                {
                    rawValue: map?.debit ?? 0,
                    value: hide ? '' : this.fyo.format(map?.debit ?? 0, 'Currency'),
                    align: 'right',
                    width: ACC_BAL_WIDTH,
                },
                {
                    rawValue: map?.credit ?? 0,
                    value: hide ? '' : this.fyo.format(map?.credit ?? 0, 'Currency'),
                    align: 'right',
                    width: ACC_BAL_WIDTH,
                },
            ];
        });
        return {
            cells: [nameCell, balanceCells].flat(2),
            level: al.level,
            isGroup: !!al.isGroup,
            folded: false,
            foldedBelow: false,
        };
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async _getQueryFilters() {
        const filters = {};
        filters.reverted = false;
        return filters;
    }
    async setDefaultFilters() {
        if (!this.toDate || !this.fromDate) {
            const { year } = DateTime.now();
            const endpoints = await getFiscalEndpoints(year + 1, year, this.fyo);
            this.fromDate = endpoints.fromDate;
            this.toDate = DateTime.fromISO(endpoints.toDate)
                .minus({ days: 1 })
                .toISODate();
        }
        await this._setDateRanges();
    }
    getFilters() {
        return [
            {
                fieldtype: 'Date',
                fieldname: 'fromDate',
                placeholder: t `From Date`,
                label: t `From Date`,
                required: true,
            },
            {
                fieldtype: 'Date',
                fieldname: 'toDate',
                placeholder: t `To Date`,
                label: t `To Date`,
                required: true,
            },
            {
                fieldtype: 'Check',
                label: t `Hide Group Amounts`,
                fieldname: 'hideGroupAmounts',
            },
        ];
    }
    getColumns() {
        return [
            {
                label: t `Account`,
                fieldtype: 'Link',
                fieldname: 'account',
                align: 'left',
                width: ACC_NAME_WIDTH,
            },
            {
                label: t `Opening (Dr)`,
                fieldtype: 'Data',
                fieldname: 'openingDebit',
                align: 'right',
                width: ACC_BAL_WIDTH,
            },
            {
                label: t `Opening (Cr)`,
                fieldtype: 'Data',
                fieldname: 'openingCredit',
                align: 'right',
                width: ACC_BAL_WIDTH,
            },
            {
                label: t `Debit`,
                fieldtype: 'Data',
                fieldname: 'debit',
                align: 'right',
                width: ACC_BAL_WIDTH,
            },
            {
                label: t `Credit`,
                fieldtype: 'Data',
                fieldname: 'credit',
                align: 'right',
                width: ACC_BAL_WIDTH,
            },
            {
                label: t `Closing (Dr)`,
                fieldtype: 'Data',
                fieldname: 'closingDebit',
                align: 'right',
                width: ACC_BAL_WIDTH,
            },
            {
                label: t `Closing (Cr)`,
                fieldtype: 'Data',
                fieldname: 'closingCredit',
                align: 'right',
                width: ACC_BAL_WIDTH,
            },
        ];
    }
}
TrialBalance.title = t `Trial Balance`;
TrialBalance.reportName = 'trial-balance';
//# sourceMappingURL=TrialBalance.js.map