import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { getDocStatusListColumn, getLedgerLinkAction } from 'models/helpers';
import { ModelNameEnum } from 'models/types';
import { SerialNumber } from './SerialNumber';
import { Transfer } from './Transfer';
import { canValidateSerialNumber, getSerialNumberFromDoc, updateSerialNumbers, validateBatch, validateSerialNumber, } from './helpers';
import { MovementTypeEnum } from './types';
export class StockMovement extends Transfer {
    constructor() {
        super(...arguments);
        this.formulas = {
            amount: {
                formula: () => {
                    return this.items?.reduce((acc, item) => acc.add(item.amount ?? 0), this.fyo.pesa(0));
                },
                dependsOn: ['items'],
            },
        };
    }
    get isTransactional() {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async getPosting() {
        return null;
    }
    async validate() {
        await super.validate();
        this.validateManufacture();
        await validateBatch(this);
        await validateSerialNumber(this);
        await validateSerialNumberStatus(this);
    }
    async afterSubmit() {
        await super.afterSubmit();
        await updateSerialNumbers(this, false);
    }
    async afterCancel() {
        await super.afterCancel();
        await updateSerialNumbers(this, true);
    }
    validateManufacture() {
        if (this.movementType !== MovementTypeEnum.Manufacture) {
            return;
        }
        const hasFrom = this.items?.findIndex((f) => f.fromLocation) !== -1;
        const hasTo = this.items?.findIndex((f) => f.toLocation) !== -1;
        if (!hasFrom) {
            throw new ValidationError(this.fyo.t `Item with From location not found`);
        }
        if (!hasTo) {
            throw new ValidationError(this.fyo.t `Item with To location not found`);
        }
    }
    static getListViewSettings(fyo) {
        const movementTypeMap = {
            [MovementTypeEnum.MaterialIssue]: fyo.t `Material Issue`,
            [MovementTypeEnum.MaterialReceipt]: fyo.t `Material Receipt`,
            [MovementTypeEnum.MaterialTransfer]: fyo.t `Material Transfer`,
            [MovementTypeEnum.Manufacture]: fyo.t `Manufacture`,
        };
        return {
            columns: [
                'name',
                getDocStatusListColumn(),
                'date',
                {
                    label: fyo.t `Movement Type`,
                    fieldname: 'movementType',
                    fieldtype: 'Select',
                    display(value) {
                        return movementTypeMap[value] ?? '';
                    },
                },
            ],
        };
    }
    _getTransferDetails() {
        return (this.items ?? []).map((row) => ({
            item: row.item,
            rate: row.rate,
            quantity: row.quantity,
            batch: row.batch,
            serialNumber: row.serialNumber,
            fromLocation: row.fromLocation,
            toLocation: row.toLocation,
        }));
    }
    static getActions(fyo) {
        return [getLedgerLinkAction(fyo, true)];
    }
    async addItem(name) {
        const itemDoc = await this.fyo.doc.getDoc(ModelNameEnum.Item, name);
        if (!itemDoc) {
            throw new ValidationError(t `Item ${name} not found`);
        }
        const item = {
            name: itemDoc.name,
            batch: itemDoc.defaultBatch ?? null,
        };
        if (item.batch) {
            const batchDoc = await this.fyo.doc.getDoc(ModelNameEnum.Batch, item.batch);
            if (batchDoc && batchDoc.item !== name) {
                throw new ValidationError(t `Batch ${item.batch} does not belong to Item ${name}`);
            }
        }
        return item;
    }
}
StockMovement.filters = {
    numberSeries: () => ({ referenceType: ModelNameEnum.StockMovement }),
};
StockMovement.defaults = {
    date: () => new Date(),
};
async function validateSerialNumberStatus(doc) {
    if (doc.isCancelled) {
        return;
    }
    for (const { serialNumber, item } of getSerialNumberFromDoc(doc)) {
        const cannotValidate = !(await canValidateSerialNumber(item, serialNumber));
        if (cannotValidate) {
            continue;
        }
        const snDoc = await doc.fyo.doc.getDoc(ModelNameEnum.SerialNumber, serialNumber);
        if (!(snDoc instanceof SerialNumber)) {
            continue;
        }
        const status = snDoc.status ?? 'Inactive';
        if (doc.movementType === 'MaterialReceipt' && status !== 'Inactive') {
            throw new ValidationError(t `Non Inactive Serial Number ${serialNumber} cannot be used for Material Receipt`);
        }
        if (doc.movementType === 'MaterialIssue' && status !== 'Active') {
            throw new ValidationError(t `Non Active Serial Number ${serialNumber} cannot be used for Material Issue`);
        }
        if (doc.movementType === 'MaterialTransfer' && status !== 'Active') {
            throw new ValidationError(t `Non Active Serial Number ${serialNumber} cannot be used for Material Transfer`);
        }
        if (item.fromLocation && status !== 'Active') {
            throw new ValidationError(t `Non Active Serial Number ${serialNumber} cannot be used as Manufacture raw material`);
        }
    }
}
//# sourceMappingURL=StockMovement.js.map