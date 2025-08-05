import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import { safeParseFloat } from 'utils/index';
import { TransferItem } from './TransferItem';
import { MovementTypeEnum } from './types';
export class StockMovementItem extends TransferItem {
    constructor() {
        super(...arguments);
        this.formulas = {
            rate: {
                formula: async () => {
                    if (!this.item) {
                        return this.rate;
                    }
                    return await this.fyo.getValue(ModelNameEnum.Item, this.item, 'rate');
                },
                dependsOn: ['item'],
            },
            amount: {
                formula: () => this.rate.mul(this.quantity),
                dependsOn: ['item', 'rate', 'quantity'],
            },
            fromLocation: {
                formula: () => {
                    if (this.isReceipt || this.isTransfer || this.isManufacture) {
                        return null;
                    }
                    const defaultLocation = this.fyo.singles.InventorySettings?.defaultLocation;
                    if (defaultLocation && !this.fromLocation && this.isIssue) {
                        return defaultLocation;
                    }
                    return this.toLocation;
                },
                dependsOn: ['movementType'],
            },
            toLocation: {
                formula: () => {
                    if (this.isIssue || this.isTransfer || this.isManufacture) {
                        return null;
                    }
                    const defaultLocation = this.fyo.singles.InventorySettings?.defaultLocation;
                    if (defaultLocation && !this.toLocation && this.isReceipt) {
                        return defaultLocation;
                    }
                    return this.toLocation;
                },
                dependsOn: ['movementType'],
            },
            unit: {
                formula: async () => (await this.fyo.getValue('Item', this.item, 'unit')),
                dependsOn: ['item'],
            },
            transferUnit: {
                formula: async (fieldname) => {
                    if (fieldname === 'quantity' || fieldname === 'unit') {
                        return this.unit;
                    }
                    return (await this.fyo.getValue('Item', this.item, 'unit'));
                },
                dependsOn: ['item', 'unit'],
            },
            transferQuantity: {
                formula: (fieldname) => {
                    if (fieldname === 'quantity' || this.unit === this.transferUnit) {
                        return this.quantity;
                    }
                    return this.transferQuantity;
                },
                dependsOn: ['item', 'quantity'],
            },
            quantity: {
                formula: async (fieldname) => {
                    if (!this.item) {
                        return this.quantity;
                    }
                    const itemDoc = await this.fyo.doc.getDoc(ModelNameEnum.Item, this.item);
                    const unitDoc = itemDoc.getLink('uom');
                    let quantity = this.quantity ?? 1;
                    if (fieldname === 'transferQuantity') {
                        quantity = this.transferQuantity * this.unitConversionFactor;
                    }
                    if (unitDoc?.isWhole) {
                        return Math.round(quantity);
                    }
                    return safeParseFloat(quantity);
                },
                dependsOn: [
                    'quantity',
                    'transferQuantity',
                    'transferUnit',
                    'unitConversionFactor',
                ],
            },
            unitConversionFactor: {
                formula: async () => {
                    if (this.unit === this.transferUnit) {
                        return 1;
                    }
                    const conversionFactor = await this.fyo.db.getAll(ModelNameEnum.UOMConversionItem, {
                        fields: ['conversionFactor'],
                        filters: { parent: this.item },
                    });
                    return safeParseFloat(conversionFactor[0]?.conversionFactor ?? 1);
                },
                dependsOn: ['transferUnit'],
            },
        };
        this.validations = {
            fromLocation: (value) => {
                if (!this.isManufacture) {
                    return;
                }
                if (value && this.toLocation) {
                    throw new ValidationError(this.fyo.t `Only From or To can be set for Manufacture`);
                }
            },
            toLocation: (value) => {
                if (!this.isManufacture) {
                    return;
                }
                if (value && this.fromLocation) {
                    throw new ValidationError(this.fyo.t `Only From or To can be set for Manufacture`);
                }
            },
            batch: async () => {
                if (!this.item || !this.batch)
                    return;
                const batchDoc = await this.fyo.doc.getDoc(ModelNameEnum.Batch, this.batch);
                if (!batchDoc)
                    return;
                if (batchDoc.item !== this.item) {
                    throw new ValidationError(t `Batch ${this.batch} does not belong to Item ${this.item}`);
                }
            },
            transferUnit: async (value) => {
                if (!this.item) {
                    return;
                }
                const item = await this.fyo.db.getAll(ModelNameEnum.UOMConversionItem, {
                    fields: ['parent'],
                    filters: { uom: value, parent: this.item },
                });
                if (item.length < 1)
                    throw new ValidationError(t `Transfer Unit ${value} is not applicable for Item ${this.item}`);
            },
        };
        this.required = {
            fromLocation: () => this.isIssue || this.isTransfer,
            toLocation: () => this.isReceipt || this.isTransfer,
        };
        this.readOnly = {
            fromLocation: () => this.isReceipt,
            toLocation: () => this.isIssue,
        };
        this.hidden = {
            batch: () => !this.fyo.singles.InventorySettings?.enableBatches,
            serialNumber: () => !this.fyo.singles.InventorySettings?.enableSerialNumber,
            transferUnit: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
            transferQuantity: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
            unitConversionFactor: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
        };
    }
    get isIssue() {
        return this.parentdoc?.movementType === MovementTypeEnum.MaterialIssue;
    }
    get isReceipt() {
        return this.parentdoc?.movementType === MovementTypeEnum.MaterialReceipt;
    }
    get isTransfer() {
        return this.parentdoc?.movementType === MovementTypeEnum.MaterialTransfer;
    }
    get isManufacture() {
        return this.parentdoc?.movementType === MovementTypeEnum.Manufacture;
    }
    async validate() {
        await super.validate();
        await this.validateBatchAndItemConsistency();
    }
    async validateBatchAndItemConsistency() {
        if (!this.batch || !this.item) {
            return;
        }
        const batchDoc = await this.fyo.doc.getDoc(ModelNameEnum.Batch, this.batch);
        if (!batchDoc) {
            return;
        }
        if (batchDoc.item !== this.item) {
            throw new ValidationError(t `Batch ${this.batch} does not belong to Item ${this.item}`);
        }
    }
}
StockMovementItem.filters = {
    item: () => ({ trackItem: true }),
};
StockMovementItem.createFilters = {
    item: () => ({ trackItem: true, itemType: 'Product' }),
};
//# sourceMappingURL=StockMovementItem.js.map