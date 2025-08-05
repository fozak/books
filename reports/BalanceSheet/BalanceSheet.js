import { t } from 'fyo';
import { AccountRootTypeEnum, } from 'models/baseModels/Account/types';
import { AccountReport, convertAccountRootNodesToAccountList, } from 'reports/AccountReport';
import { getMapFromList } from 'utils';
export class BalanceSheet extends AccountReport {
    constructor() {
        super(...arguments);
        this.loading = false;
    }
    get rootTypes() {
        return [
            AccountRootTypeEnum.Asset,
            AccountRootTypeEnum.Liability,
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
        for (const name of Object.keys(accountTree)) {
            const { rootType } = accountTree[name];
            if (this.rootTypes.includes(rootType)) {
                continue;
            }
            delete accountTree[name];
        }
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
            .filter((row) => !!row.rootNodes.length);
        this.reportData = this.getReportDataFromRows(getMapFromList(rootTypeRows, 'rootType'));
        this.loading = false;
    }
    getReportDataFromRows(rootTypeRows) {
        const typeNameList = [
            {
                rootType: AccountRootTypeEnum.Asset,
                totalName: t `Total Asset (Debit)`,
            },
            {
                rootType: AccountRootTypeEnum.Liability,
                totalName: t `Total Liability (Credit)`,
            },
            {
                rootType: AccountRootTypeEnum.Equity,
                totalName: t `Total Equity (Credit)`,
            },
        ];
        const reportData = [];
        const emptyRow = this.getEmptyRow();
        for (const { rootType, totalName } of typeNameList) {
            const row = rootTypeRows[rootType];
            if (!row) {
                continue;
            }
            reportData.push(...row.rows);
            if (row.rootNodes.length) {
                const totalNode = this.getTotalNode(row.rootNodes, totalName);
                const totalRow = this.getRowFromAccountListNode(totalNode);
                reportData.push(totalRow);
            }
            reportData.push(emptyRow);
        }
        if (reportData.at(-1)?.isEmpty) {
            reportData.pop();
        }
        return reportData;
    }
}
BalanceSheet.title = t `Balance Sheet`;
BalanceSheet.reportName = 'balance-sheet';
//# sourceMappingURL=BalanceSheet.js.map