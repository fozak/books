import { Doc } from 'fyo/model/doc';
import { AccountTypeEnum } from 'models/baseModels/Account/types';
export class InventorySettings extends Doc {
    constructor() {
        super(...arguments);
        this.readOnly = {
            enableBarcodes: () => {
                return !!this.enableBarcodes;
            },
            enableBatches: () => {
                return !!this.enableBatches;
            },
            enableSerialNumber: () => {
                return !!this.enableSerialNumber;
            },
            enableUomConversions: () => {
                return !!this.enableUomConversions;
            },
            enableStockReturns: () => {
                return !!this.enableStockReturns;
            },
            enablePointOfSale: () => {
                return !!this.fyo.singles.POSSettings?.isShiftOpen;
            },
        };
    }
}
InventorySettings.filters = {
    stockInHand: () => ({
        isGroup: false,
        accountType: AccountTypeEnum.Stock,
    }),
    stockReceivedButNotBilled: () => ({
        isGroup: false,
        accountType: AccountTypeEnum['Stock Received But Not Billed'],
    }),
    costOfGoodsSold: () => ({
        isGroup: false,
        accountType: AccountTypeEnum['Cost of Goods Sold'],
    }),
};
//# sourceMappingURL=InventorySettings.js.map