import { Doc } from 'fyo/model/doc';
import { ValidationError } from 'fyo/utils/errors';
import { AccountRootTypeEnum, AccountTypeEnum } from '../Account/types';
export class Item extends Doc {
    constructor() {
        super(...arguments);
        this.uomConversions = [];
        this.formulas = {
            incomeAccount: {
                formula: async () => {
                    let accountName = 'Service';
                    if (this.itemType === 'Product') {
                        accountName = 'Sales';
                    }
                    const accountExists = await this.fyo.db.exists('Account', accountName);
                    return accountExists ? accountName : '';
                },
                dependsOn: ['itemType'],
            },
            expenseAccount: {
                formula: async () => {
                    if (this.trackItem) {
                        return this.fyo.singles.InventorySettings
                            ?.stockReceivedButNotBilled;
                    }
                    const cogs = await this.fyo.db.getAllRaw('Account', {
                        filters: {
                            accountType: AccountTypeEnum['Cost of Goods Sold'],
                        },
                    });
                    if (cogs.length === 0) {
                        return '';
                    }
                    else {
                        return cogs[0].name;
                    }
                },
                dependsOn: ['itemType', 'trackItem'],
            },
            hsnCode: {
                formula: async () => {
                    if (!this.itemGroup) {
                        return '';
                    }
                    const itemGroupDoc = await this.fyo.doc.getDoc('ItemGroup', this.itemGroup);
                    return itemGroupDoc?.hsnCode;
                },
                dependsOn: ['itemGroup'],
            },
        };
        this.validations = {
            barcode: (value) => {
                if (value && !value.match(/^\d{12}$/)) {
                    throw new ValidationError(this.fyo.t `Barcode must be exactly 12 digits.`);
                }
            },
            rate: (value) => {
                if (value.isNegative()) {
                    throw new ValidationError(this.fyo.t `Rate can't be negative.`);
                }
            },
            hsnCode: (value) => {
                if (value && !value.match(/^\d{4,8}$/)) {
                    throw new ValidationError(this.fyo.t `Invalid HSN Code.`);
                }
            },
        };
        this.hidden = {
            trackItem: () => !this.fyo.singles.AccountingSettings?.enableInventory ||
                this.itemType !== 'Product' ||
                (this.inserted && !this.trackItem),
            barcode: () => !this.fyo.singles.InventorySettings?.enableBarcodes,
            hasBatch: () => !this.fyo.singles.InventorySettings?.enableBatches,
            hasSerialNumber: () => !(this.fyo.singles.InventorySettings?.enableSerialNumber && this.trackItem),
            uomConversions: () => !this.fyo.singles.InventorySettings?.enableUomConversions,
            itemGroup: () => !this.fyo.singles.AccountingSettings?.enableitemGroup,
        };
        this.readOnly = {
            unit: () => this.inserted,
            itemType: () => this.inserted,
            trackItem: () => this.inserted,
            hasBatch: () => this.inserted,
            hasSerialNumber: () => this.inserted,
        };
    }
    async beforeSync() {
        await super.beforeSync();
        const latestByUom = new Map();
        this.uomConversions.forEach((item) => {
            if (item.conversionFactor > 0) {
                latestByUom.set(item.uom, item);
            }
        });
        this.uomConversions = Array.from(latestByUom.values());
    }
    static getActions(fyo) {
        return [
            {
                group: fyo.t `Create`,
                label: fyo.t `Sales Invoice`,
                condition: (doc) => !doc.notInserted && doc.for !== 'Purchases',
                action: async (doc, router) => {
                    const invoice = fyo.doc.getNewDoc('SalesInvoice');
                    await invoice.append('items', {
                        item: doc.name,
                        rate: doc.rate,
                        tax: doc.tax,
                    });
                    await router.push(`/edit/SalesInvoice/${invoice.name}`);
                },
            },
            {
                group: fyo.t `Create`,
                label: fyo.t `Purchase Invoice`,
                condition: (doc) => !doc.notInserted && doc.for !== 'Sales',
                action: async (doc, router) => {
                    const invoice = fyo.doc.getNewDoc('PurchaseInvoice');
                    await invoice.append('items', {
                        item: doc.name,
                        rate: doc.rate,
                        tax: doc.tax,
                    });
                    await router.push(`/edit/PurchaseInvoice/${invoice.name}`);
                },
            },
        ];
    }
    static getListViewSettings() {
        return {
            columns: ['name', 'unit', 'tax', 'rate'],
        };
    }
}
Item.filters = {
    incomeAccount: () => ({
        isGroup: false,
        rootType: AccountRootTypeEnum.Income,
    }),
    expenseAccount: (doc) => ({
        isGroup: false,
        rootType: doc.trackItem
            ? AccountRootTypeEnum.Liability
            : AccountRootTypeEnum.Expense,
    }),
};
//# sourceMappingURL=Item.js.map