import { Transactional } from 'models/Transactional/Transactional';
import { StockManager } from './StockManager';
import { createSerialNumbers } from './helpers';
export class Transfer extends Transactional {
    async beforeSubmit() {
        await super.beforeSubmit();
        const transferDetails = this._getTransferDetails();
        await this._getStockManager().validateTransfers(transferDetails);
    }
    async afterSubmit() {
        await super.afterSubmit();
        await createSerialNumbers(this);
        const transferDetails = this._getTransferDetails();
        await this._getStockManager().createTransfers(transferDetails);
    }
    async beforeCancel() {
        await super.beforeCancel();
        const transferDetails = this._getTransferDetails();
        const stockManager = this._getStockManager();
        stockManager.isCancelled = true;
        await stockManager.validateCancel(transferDetails);
    }
    async afterCancel() {
        await super.afterCancel();
        await this._getStockManager().cancelTransfers();
    }
    _getStockManager() {
        let date = this.date;
        if (typeof date === 'string') {
            date = new Date(date);
        }
        return new StockManager({
            date,
            referenceName: this.name,
            referenceType: this.schemaName,
        }, this.isCancelled, this.fyo);
    }
}
//# sourceMappingURL=Transfer.js.map