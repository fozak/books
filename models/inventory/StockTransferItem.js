import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import { safeParseFloat } from 'utils/index';
import { TransferItem } from './TransferItem';
export class StockTransferItem extends TransferItem {
    constructor() {
        super(...arguments);
        this.formulas = {
            description: {
                formula: async () => (await this.fyo.getValue('Item', this.item, 'description')),
                dependsOn: ['item'],
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
                    if (this.isReturn && quantity > 0) {
                        quantity *= -1;
                    }
                    if (!this.isReturn && quantity < 0) {
                        quantity *= -1;
                    }
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
                    'isReturn',
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
            hsnCode: {
                formula: async () => (await this.fyo.getValue('Item', this.item, 'hsnCode')),
                dependsOn: ['item'],
            },
            amount: {
                formula: () => {
                    return this.rate?.mul(this.quantity ?? 0) ?? this.fyo.pesa(0);
                },
                dependsOn: ['rate', 'quantity'],
            },
            itemDiscountAmount: {
                formula: async () => {
                    return await this.getItemDiscountAmount();
                },
                dependsOn: ['items'],
            },
            itemDiscountPercent: {
                formula: () => this.getItemDiscountPercent(),
                dependsOn: ['items'],
            },
            rate: {
                formula: async () => {
                    const rate = (await this.fyo.getValue('Item', this.item, 'rate'));
                    if (!rate?.float && this.rate?.float) {
                        return this.rate;
                    }
                    return rate ?? this.fyo.pesa(0);
                },
                dependsOn: ['item'],
            },
            account: {
                formula: () => {
                    let accountType = 'expenseAccount';
                    if (this.isSales) {
                        accountType = 'incomeAccount';
                    }
                    return this.fyo.getValue('Item', this.item, accountType);
                },
                dependsOn: ['item'],
            },
            location: {
                formula: () => {
                    if (this.location) {
                        return;
                    }
                    const defaultLocation = this.fyo.singles.InventorySettings?.defaultLocation;
                    if (defaultLocation && !this.location) {
                        return defaultLocation;
                    }
                },
            },
        };
        this.validations = {
            transferUnit: async (value) => {
                if (!this.item) {
                    return;
                }
                const item = await this.fyo.db.getAll(ModelNameEnum.UOMConversionItem, {
                    fields: ['parent'],
                    filters: { uom: value, parent: this.item },
                });
                if (item.length < 1)
                    throw new ValidationError(this.fyo.t `Transfer Unit ${value} is not applicable for Item ${this.item}`);
            },
        };
        this.hidden = {
            itemDiscountAmount: () => {
                if (this.itemDiscountAmount && !this.itemDiscountAmount?.isZero()) {
                    return false;
                }
                return true;
            },
            itemDiscountPercent: () => !this.itemDiscountPercent,
            batch: () => !this.fyo.singles.InventorySettings?.enableBatches,
            serialNumber: () => !this.fyo.singles.InventorySettings?.enableSerialNumber,
            transferUnit: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
            transferQuantity: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
            unitConversionFactor: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
        };
    }
    get isSales() {
        return this.schemaName === ModelNameEnum.ShipmentItem;
    }
    get isReturn() {
        return !!this.parentdoc?.isReturn;
    }
    async getItemDiscountAmount() {
        const docData = (await this.fyo.doc.getDoc(this.parentSchemaName == ModelNameEnum.Shipment
            ? ModelNameEnum.SalesInvoice
            : ModelNameEnum.PurchaseInvoice, this.parentdoc?.backReference));
        const discountAmount = docData?.items?.find((val) => val.item === this.item)?.itemDiscountAmount;
        return discountAmount;
    }
    async getItemDiscountPercent() {
        const docData = (await this.fyo.doc.getDoc(this.parentSchemaName == ModelNameEnum.Shipment
            ? ModelNameEnum.SalesInvoice
            : ModelNameEnum.PurchaseInvoice, this.parentdoc?.backReference));
        const discountPercent = docData?.items?.find((val) => val.item === this.item)?.itemDiscountPercent;
        return discountPercent;
    }
}
StockTransferItem.filters = {
    item: (doc) => {
        let itemNotFor = 'Sales';
        if (doc.isSales) {
            itemNotFor = 'Purchases';
        }
        return { for: ['not in', [itemNotFor]], trackItem: true };
    },
};
//# sourceMappingURL=StockTransferItem.js.map