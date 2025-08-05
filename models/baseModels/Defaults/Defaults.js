var _a;
import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
import { PartyRoleEnum } from '../Party/types';
export class Defaults extends Doc {
    constructor() {
        super(...arguments);
        this.hidden = {
            stockMovementNumberSeries: this.getInventoryHidden(),
            shipmentNumberSeries: this.getInventoryHidden(),
            purchaseReceiptNumberSeries: this.getInventoryHidden(),
            shipmentTerms: this.getInventoryHidden(),
            purchaseReceiptTerms: this.getInventoryHidden(),
            shipmentPrintTemplate: this.getInventoryHidden(),
            purchaseReceiptPrintTemplate: this.getInventoryHidden(),
            stockMovementPrintTemplate: this.getInventoryHidden(),
            posCashDenominations: this.getPointOfSaleHidden(),
            posCustomer: this.getPointOfSaleHidden(),
            saveButtonColour: this.getPointOfSaleHidden(),
            cancelButtonColour: this.getPointOfSaleHidden(),
            submitButtonColour: this.getPointOfSaleHidden(),
            heldButtonColour: this.getPointOfSaleHidden(),
            returnButtonColour: this.getPointOfSaleHidden(),
            buyButtonColour: this.getPointOfSaleHidden(),
            payButtonColour: this.getPointOfSaleHidden(),
            payAndPrintButtonColour: this.getPointOfSaleHidden(),
        };
    }
    getInventoryHidden() {
        return () => !this.fyo.singles.AccountingSettings?.enableInventory;
    }
    getPointOfSaleHidden() {
        return () => !this.fyo.singles.InventorySettings?.enablePointOfSale;
    }
}
_a = Defaults;
Defaults.commonFilters = {
    // Auto Payments
    salesPaymentAccount: () => ({ isGroup: false, accountType: 'Cash' }),
    purchasePaymentAccount: () => ({ isGroup: false, accountType: 'Cash' }),
    // Number Series
    salesQuoteNumberSeries: () => ({
        referenceType: ModelNameEnum.SalesQuote,
    }),
    salesInvoiceNumberSeries: () => ({
        referenceType: ModelNameEnum.SalesInvoice,
    }),
    purchaseInvoiceNumberSeries: () => ({
        referenceType: ModelNameEnum.PurchaseInvoice,
    }),
    journalEntryNumberSeries: () => ({
        referenceType: ModelNameEnum.JournalEntry,
    }),
    paymentNumberSeries: () => ({
        referenceType: ModelNameEnum.Payment,
    }),
    stockMovementNumberSeries: () => ({
        referenceType: ModelNameEnum.StockMovement,
    }),
    shipmentNumberSeries: () => ({
        referenceType: ModelNameEnum.Shipment,
    }),
    purchaseReceiptNumberSeries: () => ({
        referenceType: ModelNameEnum.PurchaseReceipt,
    }),
    // Print Templates
    salesQuotePrintTemplate: () => ({ type: ModelNameEnum.SalesQuote }),
    salesInvoicePrintTemplate: () => ({ type: ModelNameEnum.SalesInvoice }),
    posPrintTemplate: () => ({ type: ModelNameEnum.SalesInvoice }),
    purchaseInvoicePrintTemplate: () => ({
        type: ModelNameEnum.PurchaseInvoice,
    }),
    journalEntryPrintTemplate: () => ({ type: ModelNameEnum.JournalEntry }),
    paymentPrintTemplate: () => ({ type: ModelNameEnum.Payment }),
    shipmentPrintTemplate: () => ({ type: ModelNameEnum.Shipment }),
    purchaseReceiptPrintTemplate: () => ({
        type: ModelNameEnum.PurchaseReceipt,
    }),
    stockMovementPrintTemplate: () => ({ type: ModelNameEnum.StockMovement }),
    posCustomer: () => ({ role: PartyRoleEnum.Customer }),
};
Defaults.filters = _a.commonFilters;
Defaults.createFilters = _a.commonFilters;
export const numberSeriesDefaultsMap = {
    [ModelNameEnum.SalesInvoice]: 'salesInvoiceNumberSeries',
    [ModelNameEnum.PurchaseInvoice]: 'purchaseInvoiceNumberSeries',
    [ModelNameEnum.JournalEntry]: 'journalEntryNumberSeries',
    [ModelNameEnum.Payment]: 'paymentNumberSeries',
    [ModelNameEnum.StockMovement]: 'stockMovementNumberSeries',
    [ModelNameEnum.Shipment]: 'shipmentNumberSeries',
    [ModelNameEnum.PurchaseReceipt]: 'purchaseReceiptNumberSeries',
    [ModelNameEnum.SalesQuote]: 'salesQuoteNumberSeries',
};
//# sourceMappingURL=Defaults.js.map