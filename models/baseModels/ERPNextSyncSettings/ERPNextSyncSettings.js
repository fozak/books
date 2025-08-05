import { Doc } from 'fyo/model/doc';
import { initERPNSync } from 'src/utils/erpnextSync';
export class ERPNextSyncSettings extends Doc {
    constructor() {
        super(...arguments);
        this.hidden = {
            syncPriceList: () => {
                return !this.fyo.singles.AccountingSettings?.enablePriceList;
            },
            priceListSyncType: () => {
                return !this.fyo.singles.AccountingSettings?.enablePriceList;
            },
            syncSerialNumber: () => {
                return !this.fyo.singles.InventorySettings?.enableSerialNumber;
            },
            serialNumberSyncType: () => {
                return !this.fyo.singles.InventorySettings?.enableSerialNumber;
            },
            syncBatch: () => {
                return !this.fyo.singles.InventorySettings?.enableBatches;
            },
            batchSyncType: () => {
                return !this.fyo.singles.InventorySettings?.enableBatches;
            },
        };
    }
    async change(ch) {
        if (ch.changed === 'syncDataFromServer') {
            await initERPNSync(this.fyo);
            ipc.reloadWindow();
        }
    }
}
//# sourceMappingURL=ERPNextSyncSettings.js.map