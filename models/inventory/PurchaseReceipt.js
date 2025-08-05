import { getStockTransferActions, getTransactionStatusColumn, } from 'models/helpers';
import { StockTransfer } from './StockTransfer';
import { ModelNameEnum } from 'models/types';
export class PurchaseReceipt extends StockTransfer {
    static getListViewSettings() {
        return {
            columns: [
                'name',
                getTransactionStatusColumn(),
                'party',
                'date',
                'grandTotal',
            ],
        };
    }
    static getActions(fyo) {
        return getStockTransferActions(fyo, ModelNameEnum.PurchaseReceipt);
    }
}
//# sourceMappingURL=PurchaseReceipt.js.map