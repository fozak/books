import { Doc } from 'fyo/model/doc';
import { AccountRootTypeEnum, AccountTypeEnum, } from 'models/baseModels/Account/types';
export class POSSettings extends Doc {
    constructor() {
        super(...arguments);
        this.hidden = {
            weightEnabledBarcode: () => !this.fyo.singles.InventorySettings?.enableBarcodes,
            checkDigits: () => !this.fyo.singles.InventorySettings?.enableBarcodes ||
                !this.weightEnabledBarcode,
            itemCodeDigits: () => !this.fyo.singles.InventorySettings?.enableBarcodes ||
                !this.weightEnabledBarcode,
            itemWeightDigits: () => !this.fyo.singles.InventorySettings?.enableBarcodes ||
                !this.weightEnabledBarcode,
            itemVisibility: () => !this.fyo.singles.AccountingSettings?.enablePointOfSaleWithOutInventory,
        };
    }
}
POSSettings.filters = {
    cashAccount: () => ({
        rootType: AccountRootTypeEnum.Asset,
        accountType: AccountTypeEnum.Cash,
        isGroup: false,
    }),
    defaultAccount: () => ({
        isGroup: false,
        accountType: AccountTypeEnum.Receivable,
    }),
};
//# sourceMappingURL=POSSettings.js.map