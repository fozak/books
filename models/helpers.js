import { AccountRootTypeEnum, } from './baseModels/Account/types';
import { t } from 'fyo';
import { ModelNameEnum } from './types';
import { DateTime } from 'luxon';
import { Invoice } from './baseModels/Invoice/Invoice';
import { StockTransfer } from './inventory/StockTransfer';
import { ValidationError } from 'fyo/utils/errors';
import { isPesa } from 'fyo/utils';
import { numberSeriesDefaultsMap } from './baseModels/Defaults/Defaults';
import { safeParseFloat } from 'utils/index';
import { PriceList } from './baseModels/PriceList/PriceList';
import { SalesInvoiceItem } from './baseModels/SalesInvoiceItem/SalesInvoiceItem';
import { ValuationMethod } from './inventory/types';
import { getRawStockLedgerEntries, getStockBalanceEntries, getStockLedgerEntries, } from 'reports/inventory/helpers';
export function getQuoteActions(fyo, schemaName) {
    return [getMakeInvoiceAction(fyo, schemaName)];
}
export function getLeadActions(fyo) {
    return [getCreateCustomerAction(fyo), getSalesQuoteAction(fyo)];
}
export function getInvoiceActions(fyo, schemaName) {
    return [
        getMakePaymentAction(fyo),
        getMakeStockTransferAction(fyo, schemaName),
        getLedgerLinkAction(fyo),
        getMakeReturnDocAction(fyo),
    ];
}
export async function getItemQtyMap(doc) {
    const itemQtyMap = {};
    const valuationMethod = doc.fyo.singles.InventorySettings?.valuationMethod ??
        ValuationMethod.FIFO;
    const rawSLEs = await getRawStockLedgerEntries(doc.fyo);
    const rawData = getStockLedgerEntries(rawSLEs, valuationMethod);
    const posProfileName = doc.fyo.singles.POSSettings?.posProfile;
    let inventoryLocation;
    if (posProfileName) {
        const posProfile = await doc.fyo.doc.getDoc(ModelNameEnum.POSProfile, posProfileName);
        inventoryLocation = posProfile?.inventory;
    }
    else {
        inventoryLocation = doc.fyo.singles.POSSettings?.inventory;
    }
    const stockBalance = getStockBalanceEntries(rawData, {
        location: inventoryLocation,
    });
    for (const row of stockBalance) {
        if (!itemQtyMap[row.item]) {
            itemQtyMap[row.item] = { availableQty: 0 };
        }
        if (row.batch) {
            itemQtyMap[row.item][row.batch] = row.balanceQuantity;
        }
        itemQtyMap[row.item].availableQty += row.balanceQuantity;
    }
    return itemQtyMap;
}
export function getStockTransferActions(fyo, schemaName) {
    return [
        getMakeInvoiceAction(fyo, schemaName),
        getLedgerLinkAction(fyo, false),
        getLedgerLinkAction(fyo, true),
        getMakeReturnDocAction(fyo),
    ];
}
export function getMakeStockTransferAction(fyo, schemaName) {
    let label = fyo.t `Shipment`;
    if (schemaName === ModelNameEnum.PurchaseInvoice) {
        label = fyo.t `Purchase Receipt`;
    }
    return {
        label,
        group: fyo.t `Create`,
        condition: (doc) => doc.isSubmitted && !!doc.stockNotTransferred,
        action: async (doc) => {
            const transfer = await doc.getStockTransfer();
            if (!transfer || !transfer.name) {
                return;
            }
            const { routeTo } = await import('src/utils/ui');
            const path = `/edit/${transfer.schemaName}/${transfer.name}`;
            await routeTo(path);
        },
    };
}
export function getMakeInvoiceAction(fyo, schemaName) {
    let label = fyo.t `Sales Invoice`;
    if (schemaName === ModelNameEnum.PurchaseReceipt) {
        label = fyo.t `Purchase Invoice`;
    }
    return {
        label,
        group: fyo.t `Create`,
        condition: (doc) => {
            if (schemaName === ModelNameEnum.SalesQuote) {
                return doc.isSubmitted;
            }
            else {
                return doc.isSubmitted && !doc.backReference;
            }
        },
        action: async (doc) => {
            const invoice = await doc.getInvoice();
            if (!invoice || !invoice.name) {
                return;
            }
            const { routeTo } = await import('src/utils/ui');
            const path = `/edit/${invoice.schemaName}/${invoice.name}`;
            await routeTo(path);
        },
    };
}
export function getCreateCustomerAction(fyo) {
    return {
        group: fyo.t `Create`,
        label: fyo.t `Customer`,
        condition: (doc) => !doc.notInserted,
        action: async (doc, router) => {
            const customerData = doc.createCustomer();
            if (!customerData.name) {
                return;
            }
            await router.push(`/edit/Party/${customerData.name}`);
        },
    };
}
export function getSalesQuoteAction(fyo) {
    return {
        group: fyo.t `Create`,
        label: fyo.t `Sales Quote`,
        condition: (doc) => !doc.notInserted,
        action: async (doc, router) => {
            const salesQuoteData = doc.createSalesQuote();
            if (!salesQuoteData.name) {
                return;
            }
            await router.push(`/edit/SalesQuote/${salesQuoteData.name}`);
        },
    };
}
export function getMakePaymentAction(fyo) {
    return {
        label: fyo.t `Payment`,
        group: fyo.t `Create`,
        condition: (doc) => doc.isSubmitted && !doc.outstandingAmount.isZero(),
        action: async (doc, router) => {
            const schemaName = doc.schema.name;
            const payment = doc.getPayment();
            if (!payment) {
                return;
            }
            await payment?.set('referenceType', schemaName);
            const currentRoute = router.currentRoute.value.fullPath;
            payment.once('afterSync', async () => {
                await payment.submit();
                await doc.load();
                await router.push(currentRoute);
            });
            const hideFields = ['party', 'for'];
            if (!fyo.singles.AccountingSettings?.enableInvoiceReturns) {
                hideFields.push('paymentType');
            }
            if (doc.schemaName === ModelNameEnum.SalesInvoice) {
                hideFields.push('account');
            }
            else {
                hideFields.push('paymentAccount');
            }
            await payment.runFormulas();
            const { openQuickEdit } = await import('src/utils/ui');
            await openQuickEdit({
                doc: payment,
                hideFields,
            });
        },
    };
}
export function getLedgerLinkAction(fyo, isStock = false) {
    let label = fyo.t `Accounting Entries`;
    let reportClassName = 'GeneralLedger';
    if (isStock) {
        label = fyo.t `Stock Entries`;
        reportClassName = 'StockLedger';
    }
    return {
        label,
        group: fyo.t `View`,
        condition: (doc) => doc.isSubmitted,
        action: async (doc, router) => {
            const route = getLedgerLink(doc, reportClassName);
            await router.push(route);
        },
    };
}
export function getLedgerLink(doc, reportClassName) {
    return {
        name: 'Report',
        params: {
            reportClassName,
            defaultFilters: JSON.stringify({
                referenceType: doc.schemaName,
                referenceName: doc.name,
            }),
        },
    };
}
export function getMakeReturnDocAction(fyo) {
    return {
        label: fyo.t `Return`,
        group: fyo.t `Create`,
        condition: (doc) => (!!fyo.singles.AccountingSettings?.enableInvoiceReturns ||
            !!fyo.singles.InventorySettings?.enableStockReturns) &&
            doc.isSubmitted &&
            !doc.isReturn,
        action: async (doc) => {
            let returnDoc;
            if (doc instanceof Invoice || doc instanceof StockTransfer) {
                returnDoc = await doc.getReturnDoc();
            }
            if (!returnDoc || !returnDoc.name) {
                return;
            }
            const { routeTo } = await import('src/utils/ui');
            const path = `/edit/${doc.schemaName}/${returnDoc.name}`;
            await routeTo(path);
        },
    };
}
export function getTransactionStatusColumn() {
    return {
        label: t `Status`,
        fieldname: 'status',
        fieldtype: 'Select',
        render(doc) {
            const status = getDocStatus(doc);
            const color = statusColor[status] ?? 'gray';
            const label = getStatusText(status);
            return {
                template: `<Badge class="text-xs" color="${color}">${label}</Badge>`,
                metadata: {
                    status,
                    color,
                    label,
                },
            };
        },
    };
}
export function getLeadStatusColumn() {
    return {
        label: t `Status`,
        fieldname: 'status',
        fieldtype: 'Select',
        render(doc) {
            const status = getLeadStatus(doc);
            const color = statusColor[status] ?? 'gray';
            const label = getStatusTextOfLead(status);
            return {
                template: `<Badge class="text-xs" color="${color}">${label}</Badge>`,
            };
        },
    };
}
export const statusColor = {
    '': 'gray',
    Draft: 'gray',
    Open: 'gray',
    Replied: 'yellow',
    Opportunity: 'yellow',
    Unpaid: 'orange',
    Paid: 'green',
    PartlyPaid: 'yellow',
    Interested: 'yellow',
    Converted: 'green',
    Quotation: 'green',
    Saved: 'blue',
    NotSaved: 'gray',
    Submitted: 'green',
    Cancelled: 'red',
    DonotContact: 'red',
    Return: 'lime',
    ReturnIssued: 'lime',
};
export function getStatusText(status) {
    switch (status) {
        case 'Draft':
            return t `Draft`;
        case 'Saved':
            return t `Saved`;
        case 'NotSaved':
            return t `Not Saved`;
        case 'Submitted':
            return t `Submitted`;
        case 'Cancelled':
            return t `Cancelled`;
        case 'Paid':
            return t `Paid`;
        case 'Unpaid':
            return t `Unpaid`;
        case 'PartlyPaid':
            return t `Partly Paid`;
        case 'Return':
            return t `Return`;
        case 'ReturnIssued':
            return t `Return Issued`;
        default:
            return '';
    }
}
export function getStatusTextOfLead(status) {
    switch (status) {
        case 'Open':
            return t `Open`;
        case 'Replied':
            return t `Replied`;
        case 'Opportunity':
            return t `Opportunity`;
        case 'Interested':
            return t `Interested`;
        case 'Converted':
            return t `Converted`;
        case 'Quotation':
            return t `Quotation`;
        case 'DonotContact':
            return t `Do not Contact`;
        default:
            return '';
    }
}
export function getLeadStatus(doc) {
    if (!doc) {
        return '';
    }
    return doc.status;
}
export function getDocStatus(doc) {
    if (!doc) {
        return '';
    }
    if (doc.notInserted) {
        return 'Draft';
    }
    if (doc.dirty) {
        return 'NotSaved';
    }
    if (!doc.schema?.isSubmittable) {
        return 'Saved';
    }
    return getSubmittableDocStatus(doc);
}
function getSubmittableDocStatus(doc) {
    if ([ModelNameEnum.SalesInvoice, ModelNameEnum.PurchaseInvoice].includes(doc.schema.name)) {
        return getInvoiceStatus(doc);
    }
    if ([ModelNameEnum.Shipment, ModelNameEnum.PurchaseReceipt].includes(doc.schema.name)) {
        if (!!doc.returnAgainst && doc.submitted && !doc.cancelled) {
            return 'Return';
        }
        if (doc.isReturned && doc.submitted && !doc.cancelled) {
            return 'ReturnIssued';
        }
    }
    if (!!doc.submitted && !doc.cancelled) {
        return 'Submitted';
    }
    if (!!doc.submitted && !!doc.cancelled) {
        return 'Cancelled';
    }
    return 'Saved';
}
export function getInvoiceStatus(doc) {
    if (doc.submitted && !doc.cancelled && doc.returnAgainst) {
        return 'Return';
    }
    if (doc.submitted && !doc.cancelled && doc.isReturned) {
        return 'ReturnIssued';
    }
    if (doc.submitted &&
        !doc.cancelled &&
        doc.outstandingAmount.isZero()) {
        return 'Paid';
    }
    if (doc.submitted &&
        !doc.cancelled &&
        doc.outstandingAmount.eq(doc.grandTotal)) {
        return 'Unpaid';
    }
    if (doc.cancelled) {
        return 'Cancelled';
    }
    if (doc.submitted &&
        !doc.isCancelled &&
        doc.outstandingAmount.isPositive() &&
        doc.outstandingAmount.neq(doc.grandTotal)) {
        return 'PartlyPaid';
    }
    return 'Saved';
}
export function getSerialNumberStatusColumn() {
    return {
        label: t `Status`,
        fieldname: 'status',
        fieldtype: 'Select',
        render(doc) {
            let status = doc.status;
            if (typeof status !== 'string') {
                status = 'Inactive';
            }
            const color = serialNumberStatusColor[status] ?? 'gray';
            const label = getSerialNumberStatusText(status);
            return {
                template: `<Badge class="text-xs" color="${color}">${label}</Badge>`,
            };
        },
    };
}
export const serialNumberStatusColor = {
    Inactive: 'gray',
    Active: 'green',
    Delivered: 'blue',
};
export function getSerialNumberStatusText(status) {
    switch (status) {
        case 'Inactive':
            return t `Inactive`;
        case 'Active':
            return t `Active`;
        case 'Delivered':
            return t `Delivered`;
        default:
            return t `Inactive`;
    }
}
export function getPriceListStatusColumn() {
    return {
        label: t `Enabled For`,
        fieldname: 'enabledFor',
        fieldtype: 'Select',
        render({ isSales, isPurchase }) {
            let status = t `None`;
            if (isSales && isPurchase) {
                status = t `Sales and Purchase`;
            }
            else if (isSales) {
                status = t `Sales`;
            }
            else if (isPurchase) {
                status = t `Purchase`;
            }
            return {
                template: `<Badge class="text-xs" color="gray">${status}</Badge>`,
            };
        },
    };
}
export function getIsDocEnabledColumn() {
    return {
        label: t `Enabled`,
        fieldname: 'enabled',
        fieldtype: 'Data',
        render(doc) {
            let status = t `Disabled`;
            let color = 'orange';
            if (doc.isEnabled) {
                status = t `Enabled`;
                color = 'green';
            }
            return {
                template: `<Badge class="text-xs" color="${color}">${status}</Badge>`,
            };
        },
    };
}
export async function getExchangeRate({ fromCurrency, toCurrency, date, }) {
    if (!fetch) {
        return 1;
    }
    if (!date) {
        date = DateTime.local().toISODate();
    }
    const cacheKey = `currencyExchangeRate:${date}:${fromCurrency}:${toCurrency}`;
    let exchangeRate = 0;
    if (localStorage) {
        exchangeRate = safeParseFloat(localStorage.getItem(cacheKey));
    }
    if (exchangeRate && exchangeRate !== 1) {
        return exchangeRate;
    }
    try {
        const res = await fetch(`https://api.vatcomply.com/rates?date=${date}&base=${fromCurrency}&symbols=${toCurrency}`);
        const data = (await res.json());
        exchangeRate = data.rates[toCurrency];
    }
    catch (error) {
        exchangeRate ?? (exchangeRate = 1);
    }
    if (localStorage) {
        localStorage.setItem(cacheKey, String(exchangeRate));
    }
    return exchangeRate;
}
export function isCredit(rootType) {
    switch (rootType) {
        case AccountRootTypeEnum.Asset:
            return false;
        case AccountRootTypeEnum.Liability:
            return true;
        case AccountRootTypeEnum.Equity:
            return true;
        case AccountRootTypeEnum.Expense:
            return false;
        case AccountRootTypeEnum.Income:
            return true;
        default:
            return true;
    }
}
export function getNumberSeries(schemaName, fyo) {
    const numberSeriesKey = numberSeriesDefaultsMap[schemaName];
    if (!numberSeriesKey) {
        return undefined;
    }
    const defaults = fyo.singles.Defaults;
    const field = fyo.getField(schemaName, 'numberSeries');
    const value = defaults?.[numberSeriesKey];
    return value ?? field?.default;
}
export function getDocStatusListColumn() {
    return {
        label: t `Status`,
        fieldname: 'status',
        fieldtype: 'Select',
        render(doc) {
            const status = getDocStatus(doc);
            const color = statusColor[status] ?? 'gray';
            const label = getStatusText(status);
            return {
                template: `<Badge class="text-xs" color="${color}">${label}</Badge>`,
                metadata: {
                    status,
                    color,
                    label,
                },
            };
        },
    };
}
export async function addItem(name, doc) {
    if (!doc.canEdit) {
        return;
    }
    const items = (doc.items ?? []);
    let item = items.find((i) => i.item === name);
    if (item) {
        const q = item.quantity ?? 0;
        await item.set('quantity', q + 1);
        return;
    }
    await doc.append('items');
    item = doc.items?.at(-1);
    if (!item) {
        return;
    }
    await item.set('item', name);
}
export async function getReturnLoyaltyPoints(doc) {
    const returnDocs = await doc.fyo.db.getAll(doc.schemaName, {
        fields: ['*'],
        filters: {
            returnAgainst: doc.returnAgainst,
            submitted: true,
        },
    });
    const totalLoyaltyPoints = returnDocs.reduce((sum, doc) => sum + Math.abs(doc.loyaltyPoints), 0);
    const loyaltyPoints = await doc.fyo.getValue(ModelNameEnum.SalesInvoice, doc.returnAgainst, 'loyaltyPoints');
    return Math.abs(loyaltyPoints - Math.abs(totalLoyaltyPoints));
}
export async function getReturnQtyTotal(doc) {
    const returnDocs = await doc.fyo.db.getAll(doc.schemaName, {
        fields: ['*'],
        filters: {
            returnAgainst: doc.name,
        },
    });
    const returnedDocs = await Promise.all(returnDocs.map((d) => doc.fyo.doc.getDoc(doc.schemaName, d.name)));
    const quantitySum = {};
    for (const item of doc.items || []) {
        const itemName = item.item;
        const batch = item.batch;
        const qty = item.quantity;
        if (!itemName) {
            continue;
        }
        if (batch) {
            if (!quantitySum[itemName]) {
                quantitySum[itemName] = { quantity: qty, batches: { [batch]: qty } };
            }
            else {
                const entry = quantitySum[itemName];
                entry.quantity += qty;
                entry.batches[batch] = (entry.batches[batch] || 0) + qty;
            }
        }
        else {
            quantitySum[itemName] = (quantitySum[itemName] || 0) + qty;
        }
    }
    for (const returnedDoc of returnedDocs) {
        for (const item of returnedDoc?.items || []) {
            const itemName = item.item;
            const batch = item.batch;
            const qty = Math.abs(item.quantity);
            if (!itemName || !quantitySum[itemName]) {
                continue;
            }
            if (batch && quantitySum[itemName]) {
                const entry = quantitySum[itemName];
                entry.quantity -= qty;
                if (entry.batches?.[batch]) {
                    entry.batches[batch] -= qty;
                }
            }
            else {
                quantitySum[itemName] = quantitySum[itemName] - qty;
            }
        }
    }
    return quantitySum;
}
export async function createLoyaltyPointEntry(doc) {
    const loyaltyProgramDoc = (await doc.fyo.doc.getDoc(ModelNameEnum.LoyaltyProgram, doc?.loyaltyProgram));
    if (!loyaltyProgramDoc.isEnabled) {
        return;
    }
    const expiryDate = new Date(Date.now());
    expiryDate.setDate(expiryDate.getDate() + (loyaltyProgramDoc.expiryDuration || 0));
    let loyaltyProgramTier;
    let loyaltyPoint;
    if (doc.redeemLoyaltyPoints) {
        loyaltyPoint = -(doc.loyaltyPoints || 0);
    }
    else {
        loyaltyProgramTier = getLoyaltyProgramTier(loyaltyProgramDoc, doc?.grandTotal);
        if (!loyaltyProgramTier) {
            return;
        }
        const collectionFactor = loyaltyProgramTier.collectionFactor;
        loyaltyPoint = Math.round(doc?.grandTotal?.float || 0) * collectionFactor;
    }
    const newLoyaltyPointEntry = doc.fyo.doc.getNewDoc(ModelNameEnum.LoyaltyPointEntry, {
        loyaltyProgram: doc.loyaltyProgram,
        customer: doc.party,
        invoice: doc.name,
        postingDate: doc.date,
        purchaseAmount: doc.grandTotal,
        expiryDate: expiryDate,
        loyaltyProgramTier: loyaltyProgramTier?.tierName,
        loyaltyPoints: loyaltyPoint,
    });
    return await newLoyaltyPointEntry.sync();
}
export async function getAddedLPWithGrandTotal(fyo, loyaltyProgram, loyaltyPoints) {
    const loyaltyProgramDoc = (await fyo.doc.getDoc(ModelNameEnum.LoyaltyProgram, loyaltyProgram));
    const conversionFactor = loyaltyProgramDoc.conversionFactor;
    return fyo.pesa((loyaltyPoints || 0) * conversionFactor);
}
export function getLoyaltyProgramTier(loyaltyProgramData, grandTotal) {
    if (!loyaltyProgramData.collectionRules) {
        return;
    }
    let loyaltyProgramTier;
    for (const row of loyaltyProgramData.collectionRules) {
        if (isPesa(row.minimumTotalSpent)) {
            const minimumSpent = row.minimumTotalSpent;
            if (!minimumSpent.lte(grandTotal)) {
                continue;
            }
            if (!loyaltyProgramTier ||
                minimumSpent.gt(loyaltyProgramTier.minimumTotalSpent)) {
                loyaltyProgramTier = row;
            }
        }
    }
    return loyaltyProgramTier;
}
export async function removeLoyaltyPoint(doc) {
    if (!doc.loyaltyProgram) {
        return;
    }
    const data = (await doc.fyo.db.getAll(ModelNameEnum.LoyaltyPointEntry, {
        fields: ['name', 'loyaltyPoints', 'expiryDate'],
        filters: {
            loyaltyProgram: doc.loyaltyProgram,
            invoice: doc.isReturn
                ? doc.returnAgainst
                : doc.name,
        },
    }));
    if (!data.length) {
        return;
    }
    const loyalityPointEntryDoc = await doc.fyo.doc.getDoc(ModelNameEnum.LoyaltyPointEntry, data[0].name);
    const party = (await doc.fyo.doc.getDoc(ModelNameEnum.Party, doc.party));
    await loyalityPointEntryDoc.delete();
    await party.updateLoyaltyPoints();
}
export async function validateQty(sinvDoc, item, existingItems) {
    if (!item) {
        return;
    }
    let itemName = item.name;
    const itemhasBatch = await sinvDoc.fyo.getValue(ModelNameEnum.Item, item.item, 'hasBatch');
    const itemQtyMap = await getItemQtyMap(sinvDoc);
    if (item instanceof SalesInvoiceItem) {
        itemName = item.item;
    }
    if (itemhasBatch) {
        if (!item.batch) {
            throw new ValidationError(t `Please select a batch first`);
        }
    }
    const trackItem = await sinvDoc.fyo.getValue(ModelNameEnum.Item, item.item, 'trackItem');
    if (!trackItem) {
        return;
    }
    if (!itemQtyMap[itemName] || itemQtyMap[itemName].availableQty === 0) {
        throw new ValidationError(t `Item ${itemName} has Zero Quantity`);
    }
    if (item.batch) {
        if ((existingItems && !itemQtyMap[itemName]) ||
            itemQtyMap[itemName][item.batch] <
                existingItems[0]?.quantity) {
            throw new ValidationError(t `Item ${itemName} only has ${itemQtyMap[itemName][item.batch]} Quantity in batch ${item.batch}`);
        }
    }
    else {
        if ((existingItems && !itemQtyMap[itemName]) ||
            itemQtyMap[itemName].availableQty < existingItems[0]?.quantity) {
            throw new ValidationError(t `Item ${itemName} only has ${itemQtyMap[itemName].availableQty} Quantity`);
        }
    }
    return;
}
export async function getPricingRulesOfCoupons(doc, couponName, pricingRuleDocNames) {
    if (!doc?.coupons?.length && !couponName) {
        return;
    }
    let appliedCoupons = [];
    const couponsToFetch = couponName
        ? [couponName]
        : doc?.coupons?.map((coupon) => coupon.coupons);
    if (couponsToFetch?.length) {
        appliedCoupons = (await doc.fyo.db.getAll(ModelNameEnum.CouponCode, {
            fields: ['*'],
            filters: { name: ['in', couponsToFetch] },
        }));
    }
    const filteredPricingRuleNames = appliedCoupons.filter((val) => val.pricingRule === pricingRuleDocNames[0]);
    if (!filteredPricingRuleNames.length) {
        return;
    }
    const pricingRuleDocsForItem = (await doc.fyo.db.getAll(ModelNameEnum.PricingRule, {
        fields: ['*'],
        filters: {
            name: ['in', pricingRuleDocNames],
            isEnabled: true,
            isCouponCodeBased: true,
        },
        orderBy: 'priority',
        order: 'desc',
    }));
    return pricingRuleDocsForItem;
}
export async function getPricingRule(doc, couponName) {
    if (!doc.fyo.singles.AccountingSettings?.enablePricingRule ||
        !doc.isSales ||
        !doc.items) {
        return;
    }
    const pricingRules = [];
    for (const item of doc.items) {
        if (item.isFreeItem) {
            continue;
        }
        const pricingRuleDocNames = (await doc.fyo.db.getAll(ModelNameEnum.PricingRuleItem, {
            fields: ['parent'],
            filters: {
                item: item.item,
                unit: item.unit,
            },
        })).map((doc) => doc.parent);
        let pricingRuleDocsForItem;
        const pricingRuleDocs = (await doc.fyo.db.getAll(ModelNameEnum.PricingRule, {
            fields: ['*'],
            filters: {
                name: ['in', pricingRuleDocNames],
                isEnabled: true,
                isCouponCodeBased: false,
            },
            orderBy: 'priority',
            order: 'desc',
        }));
        if (pricingRuleDocs.length) {
            pricingRuleDocsForItem = pricingRuleDocs;
        }
        if (!pricingRuleDocs.length || couponName) {
            const couponPricingRules = await getPricingRulesOfCoupons(doc, couponName, pricingRuleDocNames);
            pricingRuleDocsForItem = couponPricingRules;
        }
        if (!pricingRuleDocsForItem) {
            continue;
        }
        const itemQuantity = {};
        for (const item of doc.items) {
            if (!item?.item)
                continue;
            if (!itemQuantity[item.item]) {
                itemQuantity[item.item] = item.quantity ?? 0;
            }
            else {
                itemQuantity[item.item] += item.quantity ?? 0;
            }
        }
        const filtered = filterPricingRules(doc, pricingRuleDocsForItem, itemQuantity[item.item], item.amount);
        if (!filtered.length) {
            continue;
        }
        const isPricingRuleHasConflicts = getPricingRulesConflicts(filtered);
        if (isPricingRuleHasConflicts) {
            continue;
        }
        pricingRules.push({
            applyOnItem: item.item,
            pricingRule: filtered[0],
        });
    }
    return pricingRules;
}
export async function getItemRateFromPriceList(doc, priceListName) {
    const item = doc.item;
    if (!priceListName || !item) {
        return;
    }
    const priceList = await doc.fyo.doc.getDoc(ModelNameEnum.PriceList, priceListName);
    if (!(priceList instanceof PriceList)) {
        return;
    }
    const unit = doc.unit;
    const transferUnit = doc.transferUnit;
    const plItem = priceList.priceListItem?.find((pli) => {
        if (pli.item !== item) {
            return false;
        }
        if (transferUnit && pli.unit !== transferUnit) {
            return false;
        }
        else if (unit && pli.unit !== unit) {
            return false;
        }
        return true;
    });
    return plItem?.rate;
}
export function filterPricingRules(doc, pricingRuleDocsForItem, quantity, amount) {
    const filteredPricingRules = [];
    for (const pricingRuleDoc of pricingRuleDocsForItem) {
        if (canApplyPricingRule(pricingRuleDoc, doc.date, quantity, amount)) {
            filteredPricingRules.push(pricingRuleDoc);
        }
    }
    return filteredPricingRules;
}
export function canApplyPricingRule(pricingRuleDoc, sinvDate, quantity, amount) {
    if (pricingRuleDoc.minQuantity > 0 &&
        quantity < pricingRuleDoc.minQuantity) {
        return false;
    }
    if (pricingRuleDoc.maxQuantity > 0 &&
        quantity > pricingRuleDoc.maxQuantity) {
        return false;
    }
    // Filter by Amount
    if (!pricingRuleDoc.minAmount?.isZero() &&
        amount.lte(pricingRuleDoc.minAmount)) {
        return false;
    }
    if (!pricingRuleDoc.maxAmount?.isZero() &&
        amount.gte(pricingRuleDoc.maxAmount)) {
        return false;
    }
    // Filter by Validity
    if (sinvDate) {
        if (pricingRuleDoc.validFrom &&
            new Date(sinvDate).toISOString() < pricingRuleDoc.validFrom.toISOString()) {
            return false;
        }
        if (pricingRuleDoc.validTo &&
            new Date(sinvDate).toISOString() > pricingRuleDoc.validTo.toISOString()) {
            return false;
        }
    }
    return true;
}
export function canApplyCouponCode(couponCodeData, amount, sinvDate) {
    // Filter by Amount
    if (!couponCodeData.minAmount?.isZero() &&
        amount.lte(couponCodeData.minAmount)) {
        return false;
    }
    if (!couponCodeData.maxAmount?.isZero() &&
        amount.gte(couponCodeData.maxAmount)) {
        return false;
    }
    // Filter by Validity
    if (couponCodeData.validFrom &&
        new Date(sinvDate).toISOString() < couponCodeData.validFrom.toISOString()) {
        return false;
    }
    if (couponCodeData.validTo &&
        new Date(sinvDate).toISOString() > couponCodeData.validTo.toISOString()) {
        return false;
    }
    return true;
}
export async function removeUnusedCoupons(sinvDoc) {
    if (!sinvDoc.coupons?.length) {
        return;
    }
    const applicableCouponCodes = await Promise.all(sinvDoc.coupons?.map(async (coupon) => {
        return await getApplicableCouponCodesName(coupon.coupons, sinvDoc);
    }));
    const flattedApplicableCouponCodes = applicableCouponCodes?.flat();
    const couponCodeDoc = (await sinvDoc.fyo.doc.getDoc(ModelNameEnum.CouponCode, sinvDoc.coupons[0].coupons));
    couponCodeDoc.removeUnusedCoupons(flattedApplicableCouponCodes, sinvDoc);
}
export async function getApplicableCouponCodesName(couponName, sinvDoc) {
    const couponCodeDatas = (await sinvDoc.fyo.db.getAll(ModelNameEnum.CouponCode, {
        fields: ['*'],
        filters: {
            name: couponName,
            isEnabled: true,
        },
    }));
    if (!couponCodeDatas || !couponCodeDatas.length) {
        return [];
    }
    const applicablePricingRules = await getPricingRule(sinvDoc, couponName);
    if (!applicablePricingRules?.length) {
        return [];
    }
    return applicablePricingRules
        ?.filter((rule) => rule?.pricingRule?.name === couponCodeDatas[0].pricingRule)
        .map((rule) => ({
        pricingRule: rule.pricingRule.name,
        coupon: couponCodeDatas[0].name,
    }));
}
export async function validateCouponCode(doc, value, sinvDoc) {
    const coupon = await doc.fyo.db.getAll(ModelNameEnum.CouponCode, {
        fields: [
            'minAmount',
            'maxAmount',
            'pricingRule',
            'validFrom',
            'validTo',
            'maximumUse',
            'used',
            'isEnabled',
        ],
        filters: { name: value },
    });
    if (!coupon[0]?.isEnabled) {
        throw new ValidationError('Coupon code cannot be applied as it is not enabled');
    }
    if (coupon[0]?.maximumUse <= coupon[0]?.used) {
        throw new ValidationError('Coupon code has been used maximum number of times');
    }
    if (!doc.parentdoc) {
        doc.parentdoc = sinvDoc;
    }
    const applicableCouponCodesNames = await getApplicableCouponCodesName(value, doc.parentdoc);
    if (!applicableCouponCodesNames?.length) {
        throw new ValidationError(t `Coupon ${value} is not applicable for applied items.`);
    }
    const couponExist = doc.parentdoc?.coupons?.some((coupon) => coupon?.coupons === value);
    if (couponExist) {
        throw new ValidationError(t `${value} already applied.`);
    }
    if (coupon[0].minAmount.gte(doc.parentdoc?.grandTotal) &&
        !coupon[0].minAmount.isZero()) {
        throw new ValidationError(t `The Grand Total must exceed ${coupon[0].minAmount.float} to apply the coupon ${value}.`);
    }
    if (coupon[0].maxAmount.lte(doc.parentdoc?.grandTotal) &&
        !coupon[0].maxAmount.isZero()) {
        throw new ValidationError(t `The Grand Total must be less than ${coupon[0].maxAmount.float} to apply this coupon.`);
    }
    if (coupon[0].validFrom > doc.parentdoc?.date) {
        throw new ValidationError(t `Valid From Date should be less than Valid To Date.`);
    }
    if (coupon[0].validTo < doc.parentdoc?.date) {
        throw new ValidationError(t `Valid To Date should be greater than Valid From Date.`);
    }
}
export function removeFreeItems(sinvDoc) {
    if (!sinvDoc || !sinvDoc.items) {
        return;
    }
    if (!!sinvDoc.isPricingRuleApplied) {
        return;
    }
    for (const item of sinvDoc.items) {
        if (item.isFreeItem) {
            sinvDoc.items = sinvDoc.items?.filter((invoiceItem) => invoiceItem.name !== item.name);
        }
    }
}
export async function updatePricingRule(sinvDoc) {
    const applicablePricingRuleNames = await getPricingRule(sinvDoc);
    if (!applicablePricingRuleNames || !applicablePricingRuleNames.length) {
        sinvDoc.pricingRuleDetail = undefined;
        sinvDoc.isPricingRuleApplied = false;
        removeFreeItems(sinvDoc);
        return;
    }
    const appliedPricingRuleCount = sinvDoc?.items?.filter((val) => val.isFreeItem).length;
    setTimeout(() => {
        void (async () => {
            if (appliedPricingRuleCount !== applicablePricingRuleNames?.length) {
                await sinvDoc.appendPricingRuleDetail(applicablePricingRuleNames);
                await sinvDoc.applyProductDiscount();
            }
        })();
    }, 1);
}
export function getPricingRulesConflicts(pricingRules) {
    const pricingRuleDocs = Array.from(pricingRules);
    const firstPricingRule = pricingRuleDocs.shift();
    if (!firstPricingRule) {
        return;
    }
    const conflictingPricingRuleNames = [];
    for (const pricingRuleDoc of pricingRuleDocs.slice(0)) {
        if (pricingRuleDoc.priority !== firstPricingRule?.priority) {
            continue;
        }
        conflictingPricingRuleNames.push(pricingRuleDoc.name);
    }
    if (!conflictingPricingRuleNames.length) {
        return;
    }
    return true;
}
export function roundFreeItemQty(quantity, roundingMethod) {
    return Math[roundingMethod](quantity);
}
//# sourceMappingURL=helpers.js.map