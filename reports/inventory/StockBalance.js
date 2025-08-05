import { t } from 'fyo';
import getCommonExportActions from 'reports/commonExporter';
import { getStockBalanceEntries } from './helpers';
import { StockLedger } from './StockLedger';
export class StockBalance extends StockLedger {
    constructor() {
        super(...arguments);
        this.ascending = true;
        this.referenceType = 'All';
        this.referenceName = '';
    }
    async _getReportData(force) {
        if (this.shouldRefresh || force || !this._rawData?.length) {
            await this._setRawData();
        }
        const filters = {
            item: this.item,
            location: this.location,
            batch: this.batch,
            fromDate: this.fromDate,
            toDate: this.toDate,
        };
        const rawData = getStockBalanceEntries(this._rawData ?? [], filters);
        return rawData.map((sbe, i) => {
            const row = { ...sbe, name: i + 1 };
            return this._convertRawDataRowToReportRow(row, {
                incomingQuantity: 'green',
                outgoingQuantity: 'red',
                balanceQuantity: null,
            });
        });
    }
    getFilters() {
        const filters = [
            {
                fieldtype: 'Link',
                target: 'Item',
                placeholder: t `Item`,
                label: t `Item`,
                fieldname: 'item',
            },
            {
                fieldtype: 'Link',
                target: 'Location',
                placeholder: t `Location`,
                label: t `Location`,
                fieldname: 'location',
            },
            ...(this.hasBatches
                ? [
                    {
                        fieldtype: 'Link',
                        target: 'Batch',
                        placeholder: t `Batch`,
                        label: t `Batch`,
                        fieldname: 'batch',
                    },
                ]
                : []),
            {
                fieldtype: 'Date',
                placeholder: t `From Date`,
                label: t `From Date`,
                fieldname: 'fromDate',
            },
            {
                fieldtype: 'Date',
                placeholder: t `To Date`,
                label: t `To Date`,
                fieldname: 'toDate',
            },
        ];
        return filters;
    }
    getColumns() {
        return [
            {
                fieldname: 'name',
                label: '#',
                fieldtype: 'Int',
                width: 0.5,
            },
            {
                fieldname: 'item',
                label: 'Item',
                fieldtype: 'Link',
            },
            {
                fieldname: 'location',
                label: 'Location',
                fieldtype: 'Link',
            },
            ...(this.hasBatches
                ? [
                    { fieldname: 'batch', label: 'Batch', fieldtype: 'Link' },
                ]
                : []),
            {
                fieldname: 'balanceQuantity',
                label: 'Balance Qty.',
                fieldtype: 'Float',
            },
            {
                fieldname: 'balanceValue',
                label: 'Balance Value',
                fieldtype: 'Float',
            },
            {
                fieldname: 'openingQuantity',
                label: 'Opening Qty.',
                fieldtype: 'Float',
            },
            {
                fieldname: 'openingValue',
                label: 'Opening Value',
                fieldtype: 'Float',
            },
            {
                fieldname: 'incomingQuantity',
                label: 'In Qty.',
                fieldtype: 'Float',
            },
            {
                fieldname: 'incomingValue',
                label: 'In Value',
                fieldtype: 'Currency',
            },
            {
                fieldname: 'outgoingQuantity',
                label: 'Out Qty.',
                fieldtype: 'Float',
            },
            {
                fieldname: 'outgoingValue',
                label: 'Out Value',
                fieldtype: 'Currency',
            },
            {
                fieldname: 'valuationRate',
                label: 'Valuation rate',
                fieldtype: 'Currency',
            },
        ];
    }
    getActions() {
        return getCommonExportActions(this);
    }
}
StockBalance.title = t `Stock Balance`;
StockBalance.reportName = 'stock-balance';
StockBalance.isInventory = true;
//# sourceMappingURL=StockBalance.js.map