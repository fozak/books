import { Doc } from 'fyo/model/doc';
export class StockLedgerEntry extends Doc {
    static getListViewSettings() {
        return {
            columns: [
                'date',
                'item',
                'location',
                'rate',
                'quantity',
                'referenceName',
            ],
        };
    }
}
//# sourceMappingURL=StockLedgerEntry.js.map