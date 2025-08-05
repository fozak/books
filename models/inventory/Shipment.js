import { getStockTransferActions, getTransactionStatusColumn, } from 'models/helpers';
import { ModelNameEnum } from 'models/types';
import { StockTransfer } from './StockTransfer';
export class Shipment extends StockTransfer {
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
        return getStockTransferActions(fyo, ModelNameEnum.Shipment);
    }
}
//# sourceMappingURL=Shipment.js.map