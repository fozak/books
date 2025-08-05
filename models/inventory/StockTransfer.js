import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { LedgerPosting } from 'models/Transactional/LedgerPosting';
import { Invoice } from 'models/baseModels/Invoice/Invoice';
import { addItem, getNumberSeries } from 'models/helpers';
import { ModelNameEnum } from 'models/types';
import { SerialNumber } from './SerialNumber';
import { Transfer } from './Transfer';
import { canValidateSerialNumber, getSerialNumberFromDoc, updateSerialNumbers, validateBatch, validateSerialNumber, } from './helpers';
import { getShipmentCOGSAmountFromSLEs } from 'reports/inventory/helpers';
export class StockTransfer extends Transfer {
    constructor() {
        super(...arguments);
        this.formulas = {
            grandTotal: {
                formula: async () => await this.getGrandTotal(),
                dependsOn: ['items'],
            },
        };
        this.hidden = {
            backReference: () => !(this.backReference || !(this.isSubmitted || this.isCancelled)),
            terms: () => !(this.terms || !(this.isSubmitted || this.isCancelled)),
            attachment: () => !(this.attachment || !(this.isSubmitted || this.isCancelled)),
            returnAgainst: () => (this.isSubmitted || this.isCancelled) && !this.returnAgainst,
        };
    }
    get isSales() {
        return this.schemaName === ModelNameEnum.Shipment;
    }
    get isReturn() {
        return !!this.returnAgainst;
    }
    get enableDiscounting() {
        return !!this.fyo.singles?.AccountingSettings?.enableDiscounting;
    }
    get invoiceSchemaName() {
        if (this.isSales) {
            return ModelNameEnum.SalesInvoice;
        }
        return ModelNameEnum.PurchaseInvoice;
    }
    getTotalDiscount(doc) {
        if (!this.enableDiscounting) {
            return this.fyo.pesa(0);
        }
        const itemDiscountAmount = this.getItemDiscountAmount(doc);
        const invoiceDiscountAmount = this.getInvoiceDiscountAmount(doc);
        return itemDiscountAmount.add(invoiceDiscountAmount);
    }
    getNetTotal() {
        return this.getSum('items', 'amount', false);
    }
    async getGrandTotal() {
        if (!this.backReference) {
            return this.getSum('items', 'amount', false);
        }
        const docData = await this.fyo.doc.getDoc(this.invoiceSchemaName, this.backReference);
        const totalDiscount = this.getTotalDiscount(docData);
        return (docData.taxes ?? [])
            .map((doc) => doc.amount)
            .reduce((a, b) => a.add(b), this.getNetTotal())
            .sub(totalDiscount);
    }
    getInvoiceDiscountAmount(doc) {
        if (this.setDiscountAmount) {
            return this.discountAmount ?? this.fyo.pesa(0);
        }
        let totalItemAmounts = this.fyo.pesa(0);
        for (const item of doc.items ?? []) {
            if (this.discountAfterTax) {
                totalItemAmounts = totalItemAmounts.add(item.itemTaxedTotal);
            }
            else {
                totalItemAmounts = totalItemAmounts.add(item.itemDiscountedTotal);
            }
        }
        return totalItemAmounts.percent(doc.discountPercent ?? 0) ?? 0;
    }
    getItemDiscountAmount(doc) {
        if (!this?.items?.length) {
            return this.fyo.pesa(0);
        }
        let discountAmount = this.fyo.pesa(0);
        for (const item of this.items ?? []) {
            if (!item.itemDiscountAmount.isZero()) {
                discountAmount = discountAmount.add(item.itemDiscountAmount ?? this.fyo.pesa(0));
            }
            else if (!doc.discountAfterTax) {
                const amt = (item.amount ?? this.fyo.pesa(0)).mul((item.itemDiscountPercent ?? 0) / 100);
                discountAmount = discountAmount.add(amt);
            }
            else if (doc.discountAfterTax) {
                discountAmount = discountAmount.add((item.itemTaxedTotal ?? this.fyo.pesa(0)).mul((item.itemDiscountPercent ?? 0) / 100));
            }
        }
        return discountAmount;
    }
    _getTransferDetails() {
        return (this.items ?? []).map((row) => {
            let fromLocation = undefined;
            let toLocation = undefined;
            if (this.isSales) {
                fromLocation = row.location;
            }
            else {
                toLocation = row.location;
            }
            return {
                item: row.item,
                rate: row.rate,
                quantity: row.quantity,
                batch: row.batch,
                serialNumber: row.serialNumber,
                isReturn: row.isReturn,
                fromLocation,
                toLocation,
            };
        });
    }
    async getPosting() {
        await this.validateAccounts();
        const stockInHand = (await this.fyo.getValue(ModelNameEnum.InventorySettings, 'stockInHand'));
        const amount = await this.getPostingAmount();
        const posting = new LedgerPosting(this, this.fyo);
        if (this.isSales) {
            const costOfGoodsSold = (await this.fyo.getValue(ModelNameEnum.InventorySettings, 'costOfGoodsSold'));
            if (this.isReturn) {
                await posting.debit(stockInHand, amount);
                await posting.credit(costOfGoodsSold, amount);
            }
            else {
                await posting.debit(costOfGoodsSold, amount);
                await posting.credit(stockInHand, amount);
            }
        }
        else {
            const stockReceivedButNotBilled = (await this.fyo.getValue(ModelNameEnum.InventorySettings, 'stockReceivedButNotBilled'));
            if (this.isReturn) {
                await posting.debit(stockReceivedButNotBilled, amount);
                await posting.credit(stockInHand, amount);
            }
            else {
                await posting.debit(stockInHand, amount);
                await posting.credit(stockReceivedButNotBilled, amount);
            }
        }
        await posting.makeRoundOffEntry();
        return posting;
    }
    async getPostingAmount() {
        if (!this.isSales) {
            return this.grandTotal ?? this.fyo.pesa(0);
        }
        return await getShipmentCOGSAmountFromSLEs(this);
    }
    async validateAccounts() {
        const settings = ['stockInHand'];
        if (this.isSales) {
            settings.push('costOfGoodsSold');
        }
        else {
            settings.push('stockReceivedButNotBilled');
        }
        const messages = [];
        for (const setting of settings) {
            const value = this.fyo.singles.InventorySettings?.[setting];
            const field = this.fyo.getField(ModelNameEnum.InventorySettings, setting);
            if (!value) {
                messages.push(t `${field.label} account not set in Inventory Settings.`);
                continue;
            }
            const exists = await this.fyo.db.exists(ModelNameEnum.Account, value);
            if (!exists) {
                messages.push(t `Account ${value} does not exist.`);
            }
        }
        if (messages.length) {
            throw new ValidationError(messages.join(' '));
        }
    }
    async validate() {
        await super.validate();
        await validateBatch(this);
        await validateSerialNumber(this);
        await validateSerialNumberStatus(this);
        await this._validateHasReturnDocs();
    }
    async afterSubmit() {
        await super.afterSubmit();
        await updateSerialNumbers(this, false, this.isReturn);
        await this._updateBackReference();
        await this._updateItemsReturned();
    }
    async afterCancel() {
        await super.afterCancel();
        await updateSerialNumbers(this, true, this.isReturn);
        await this._updateBackReference();
        await this._updateItemsReturned();
    }
    async _updateBackReference() {
        if (!this.isCancelled && !this.isSubmitted) {
            return;
        }
        if (!this.backReference) {
            return;
        }
        const schemaName = this.isSales
            ? ModelNameEnum.SalesInvoice
            : ModelNameEnum.PurchaseInvoice;
        const invoice = (await this.fyo.doc.getDoc(schemaName, this.backReference));
        const transferMap = this._getTransferMap();
        for (const row of invoice.items ?? []) {
            const item = row.item;
            const quantity = row.quantity;
            const notTransferred = row.stockNotTransferred ?? 0;
            const transferred = transferMap[item];
            if (typeof transferred !== 'number' ||
                typeof notTransferred !== 'number') {
                continue;
            }
            if (this.isCancelled) {
                await row.set('stockNotTransferred', Math.min(notTransferred + transferred, quantity));
                transferMap[item] = Math.max(transferred + notTransferred - quantity, 0);
            }
            else {
                await row.set('stockNotTransferred', Math.max(notTransferred - transferred, 0));
                transferMap[item] = Math.max(transferred - notTransferred, 0);
            }
        }
        const notTransferred = invoice.getStockNotTransferred();
        await invoice.setAndSync('stockNotTransferred', notTransferred);
    }
    async _updateItemsReturned() {
        if (!this.returnAgainst) {
            return;
        }
        const linkedReference = await this.loadAndGetLink('returnAgainst');
        if (!linkedReference) {
            return;
        }
        const referenceDoc = await this.fyo.doc.getDoc(this.schemaName, linkedReference.name);
        const isReturned = this.isSubmitted;
        await referenceDoc.setAndSync({ isReturned });
    }
    async _validateHasReturnDocs() {
        if (!this.name || !this.isCancelled) {
            return;
        }
        const returnDocs = await this.fyo.db.getAll(this.schemaName, {
            filters: { returnAgainst: this.name },
        });
        const hasReturnDocs = !!returnDocs.length;
        if (!hasReturnDocs) {
            return;
        }
        const returnDocNames = returnDocs.map((doc) => doc.name).join(', ');
        const label = this.fyo.schemaMap[this.schemaName]?.label ?? this.schemaName;
        throw new ValidationError(t `Cannot cancel ${this.schema.label} ${this.name} because of the following ${label}: ${returnDocNames}`);
    }
    _getTransferMap() {
        return (this.items ?? []).reduce((acc, item) => {
            var _a;
            if (!item.item) {
                return acc;
            }
            if (!item.quantity) {
                return acc;
            }
            acc[_a = item.item] ?? (acc[_a] = 0);
            acc[item.item] += item.quantity;
            return acc;
        }, {});
    }
    duplicate() {
        const doc = super.duplicate();
        doc.backReference = undefined;
        return doc;
    }
    async addItem(name) {
        return await addItem(name, this);
    }
    async change({ doc, changed }) {
        if (doc.name === this.name && changed === 'backReference') {
            await this.setFieldsFromBackReference();
        }
    }
    async setFieldsFromBackReference() {
        const backReference = this.backReference;
        const { target } = this.fyo.getField(this.schemaName, 'backReference');
        if (!backReference || !target) {
            return;
        }
        const brDoc = await this.fyo.doc.getDoc(target, backReference);
        if (!(brDoc instanceof Invoice)) {
            return;
        }
        const stDoc = await brDoc.getStockTransfer();
        if (!stDoc) {
            return;
        }
        await this.set('party', stDoc.party);
        await this.set('terms', stDoc.terms);
        await this.set('date', stDoc.date);
        await this.set('items', stDoc.items);
    }
    async getInvoice() {
        if (!this.isSubmitted || this.backReference) {
            return null;
        }
        const schemaName = this.invoiceSchemaName;
        const defaults = this.fyo.singles.Defaults ?? {};
        let terms;
        let numberSeries;
        if (this.isSales) {
            terms = defaults.salesInvoiceTerms ?? '';
            numberSeries = defaults.salesInvoiceNumberSeries ?? undefined;
        }
        else {
            terms = defaults.purchaseInvoiceTerms ?? '';
            numberSeries = defaults.purchaseInvoiceNumberSeries ?? undefined;
        }
        const data = {
            party: this.party,
            date: new Date().toISOString(),
            terms,
            numberSeries,
            backReference: this.name,
        };
        const invoice = this.fyo.doc.getNewDoc(schemaName, data);
        for (const row of this.items ?? []) {
            if (!row.item) {
                continue;
            }
            const item = row.item;
            const unit = row.unit;
            const quantity = row.quantity;
            const batch = row.batch || null;
            const rate = row.rate ?? this.fyo.pesa(0);
            const description = row.description;
            const hsnCode = row.hsnCode;
            if (!quantity) {
                continue;
            }
            await invoice.append('items', {
                item,
                quantity,
                unit,
                rate,
                batch,
                hsnCode,
                description,
            });
        }
        if (!invoice.items?.length) {
            return null;
        }
        return invoice;
    }
    async getReturnDoc() {
        if (!this.name) {
            return;
        }
        const docData = this.getValidDict(true, true);
        const docItems = docData.items;
        if (!docItems) {
            return;
        }
        let returnDocItems = [];
        const returnBalanceItemsQty = await this.fyo.db.getReturnBalanceItemsQty(this.schemaName, this.name);
        for (const item of docItems) {
            if (!returnBalanceItemsQty) {
                returnDocItems = docItems;
                returnDocItems.map((row) => {
                    row.name = undefined;
                    row.quantity *= -1;
                    return row;
                });
                break;
            }
            const isItemExist = !!returnDocItems.filter((balanceItem) => !item.batch && balanceItem.item === item.item).length;
            if (isItemExist) {
                continue;
            }
            const returnedItem = returnBalanceItemsQty[item.item];
            let quantity = returnedItem.quantity;
            let serialNumber = returnedItem.serialNumbers?.join('\n');
            if (item.batch &&
                returnedItem.batches &&
                returnedItem.batches[item.batch]) {
                quantity = returnedItem.batches[item.batch].quantity;
                if (returnedItem.batches[item.batch].serialNumbers) {
                    serialNumber =
                        returnedItem.batches[item.batch].serialNumbers?.join('\n');
                }
            }
            returnDocItems.push({
                ...item,
                serialNumber,
                name: undefined,
                quantity: quantity,
            });
        }
        const returnDocData = {
            ...docData,
            name: undefined,
            date: new Date(),
            items: returnDocItems,
            returnAgainst: docData.name,
        };
        const newReturnDoc = this.fyo.doc.getNewDoc(this.schema.name, returnDocData);
        await newReturnDoc.runFormulas();
        return newReturnDoc;
    }
}
StockTransfer.defaults = {
    numberSeries: (doc) => getNumberSeries(doc.schemaName, doc.fyo),
    terms: (doc) => {
        const defaults = doc.fyo.singles.Defaults;
        if (doc.schemaName === ModelNameEnum.Shipment) {
            return defaults?.shipmentTerms ?? '';
        }
        return defaults?.purchaseReceiptTerms ?? '';
    },
    date: () => new Date(),
};
StockTransfer.filters = {
    party: (doc) => ({
        role: ['in', [doc.isSales ? 'Customer' : 'Supplier', 'Both']],
    }),
    numberSeries: (doc) => ({ referenceType: doc.schemaName }),
    backReference: () => ({
        stockNotTransferred: ['!=', 0],
        submitted: true,
        cancelled: false,
    }),
};
StockTransfer.createFilters = {
    party: (doc) => ({
        role: doc.isSales ? 'Customer' : 'Supplier',
    }),
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
        const isSubmitted = !!doc.isSubmitted;
        const isReturn = !!doc.returnAgainst;
        if (isSubmitted || isReturn) {
            return;
        }
        if (doc.schemaName === ModelNameEnum.PurchaseReceipt &&
            status !== 'Inactive') {
            throw new ValidationError(t `Serial Number ${serialNumber} is not Inactive`);
        }
        if (doc.schemaName === ModelNameEnum.Shipment && status !== 'Active') {
            throw new ValidationError(t `Serial Number ${serialNumber} is not Active.`);
        }
    }
}
//# sourceMappingURL=StockTransfer.js.map