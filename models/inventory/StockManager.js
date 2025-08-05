var _StockManager_instances, _StockManager_sync, _StockManager_createTransfer, _StockManager_getSMIDetails, _StockManager_validate, _StockManager_validateQuantity, _StockManager_validateRate, _StockManager_validateLocation, _StockManager_validateStockAvailability, _StockManagerItem_instances, _StockManagerItem_moveStockForBothLocations, _StockManagerItem_moveStockForSingleLocation, _StockManagerItem_getSerialNumberedStockLedgerEntries, _StockManagerItem_getStockLedgerEntry, _StockManagerItem_clear;
import { __classPrivateFieldGet } from "tslib";
import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import { getSerialNumbers } from './helpers';
export class StockManager {
    constructor(details, isCancelled, fyo) {
        _StockManager_instances.add(this);
        this.items = [];
        this.details = details;
        this.isCancelled = isCancelled;
        this.fyo = fyo;
    }
    async validateTransfers(transferDetails) {
        const detailsList = transferDetails.map((d) => __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_getSMIDetails).call(this, d));
        for (const details of detailsList) {
            await __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_validate).call(this, details);
        }
    }
    async createTransfers(transferDetails) {
        const detailsList = transferDetails.map((d) => __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_getSMIDetails).call(this, d));
        for (const details of detailsList) {
            await __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_validate).call(this, details);
        }
        for (const details of detailsList) {
            __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_createTransfer).call(this, details);
        }
        await __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_sync).call(this);
    }
    async cancelTransfers() {
        const { referenceName, referenceType } = this.details;
        await this.fyo.db.deleteAll(ModelNameEnum.StockLedgerEntry, {
            referenceType,
            referenceName,
        });
    }
    async validateCancel(transferDetails) {
        const reverseTransferDetails = transferDetails.map(({ item, rate, quantity, fromLocation, toLocation, isReturn }) => ({
            item,
            rate,
            quantity,
            fromLocation: toLocation,
            toLocation: fromLocation,
            isReturn,
        }));
        await this.validateTransfers(reverseTransferDetails);
    }
}
_StockManager_instances = new WeakSet(), _StockManager_sync = async function _StockManager_sync() {
    for (const item of this.items) {
        await item.sync();
    }
}, _StockManager_createTransfer = function _StockManager_createTransfer(details) {
    const item = new StockManagerItem(details, this.fyo);
    item.transferStock();
    this.items.push(item);
}, _StockManager_getSMIDetails = function _StockManager_getSMIDetails(transferDetails) {
    return Object.assign({}, this.details, transferDetails);
}, _StockManager_validate = async function _StockManager_validate(details) {
    __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_validateRate).call(this, details);
    __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_validateQuantity).call(this, details);
    __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_validateLocation).call(this, details);
    await __classPrivateFieldGet(this, _StockManager_instances, "m", _StockManager_validateStockAvailability).call(this, details);
}, _StockManager_validateQuantity = function _StockManager_validateQuantity(details) {
    const itemVisibility = this.fyo.singles.POSSettings?.itemVisibility;
    if (itemVisibility !== 'Inventory Items') {
        return;
    }
    if (!details.quantity) {
        throw new ValidationError(t `Quantity needs to be set`);
    }
    if (!details.isReturn && details.quantity <= 0) {
        throw new ValidationError(t `Quantity (${details.quantity}) has to be greater than zero`);
    }
}, _StockManager_validateRate = function _StockManager_validateRate(details) {
    if (!details.rate) {
        throw new ValidationError(t `Rate needs to be set`);
    }
    if (details.rate.lt(0)) {
        throw new ValidationError(t `Rate (${details.rate.float}) has to be greater than zero`);
    }
}, _StockManager_validateLocation = function _StockManager_validateLocation(details) {
    if (details.fromLocation) {
        return;
    }
    if (details.toLocation) {
        return;
    }
    throw new ValidationError(t `Both From and To Location cannot be undefined`);
}, _StockManager_validateStockAvailability = async function _StockManager_validateStockAvailability(details) {
    const trackItem = await this.fyo.getValue(ModelNameEnum.Item, details.item, 'trackItem');
    if (!details.fromLocation || !trackItem) {
        return;
    }
    const date = details.date.toISOString();
    const formattedDate = this.fyo.format(details.date, 'Datetime');
    const batch = details.batch || undefined;
    const serialNumbers = getSerialNumbers(details.serialNumber ?? '');
    let quantityBefore = (await this.fyo.db.getStockQuantity(details.item, details.fromLocation, undefined, date, batch, serialNumbers)) ?? 0;
    if (this.isCancelled) {
        quantityBefore += details.quantity;
    }
    const batchMessage = !!batch ? t ` in Batch ${batch}` : '';
    if (!details.isReturn && quantityBefore < details.quantity) {
        throw new ValidationError([
            t `Insufficient Quantity.`,
            t `Additional quantity (${details.quantity - quantityBefore}) required${batchMessage} to make outward transfer of item ${details.item} from ${details.fromLocation} on ${formattedDate}`,
        ].join('\n'));
    }
    const quantityAfter = await this.fyo.db.getStockQuantity(details.item, details.fromLocation, details.date.toISOString(), undefined, batch, serialNumbers);
    if (quantityAfter === null) {
        // No future transactions
        return;
    }
    const quantityRemaining = quantityBefore - details.quantity;
    const futureQuantity = quantityRemaining + quantityAfter;
    if (futureQuantity < 0) {
        throw new ValidationError([
            t `Insufficient Quantity.`,
            t `Transfer will cause future entries to have negative stock.`,
            t `Additional quantity (${-futureQuantity}) required${batchMessage} to make outward transfer of item ${details.item} from ${details.fromLocation} on ${formattedDate}`,
        ].join('\n'));
    }
};
class StockManagerItem {
    constructor(details, fyo) {
        _StockManagerItem_instances.add(this);
        this.date = details.date;
        this.item = details.item;
        this.rate = details.rate;
        this.quantity = details.quantity;
        this.fromLocation = details.fromLocation;
        this.toLocation = details.toLocation;
        this.referenceName = details.referenceName;
        this.referenceType = details.referenceType;
        this.batch = details.batch;
        this.serialNumber = details.serialNumber;
        this.fyo = fyo;
    }
    transferStock() {
        __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_clear).call(this);
        __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_moveStockForBothLocations).call(this);
    }
    async sync() {
        const sles = [
            this.stockLedgerEntries?.filter((s) => s.quantity <= 0),
            this.stockLedgerEntries?.filter((s) => s.quantity > 0),
        ]
            .flat()
            .filter(Boolean);
        for (const sle of sles) {
            await sle.sync();
        }
    }
}
_StockManagerItem_instances = new WeakSet(), _StockManagerItem_moveStockForBothLocations = function _StockManagerItem_moveStockForBothLocations() {
    if (this.fromLocation) {
        __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_moveStockForSingleLocation).call(this, this.fromLocation, true);
    }
    if (this.toLocation) {
        __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_moveStockForSingleLocation).call(this, this.toLocation, false);
    }
}, _StockManagerItem_moveStockForSingleLocation = function _StockManagerItem_moveStockForSingleLocation(location, isOutward) {
    let quantity = this.quantity;
    if (quantity === 0) {
        return;
    }
    const serialNumbers = getSerialNumbers(this.serialNumber ?? '');
    if (serialNumbers.length) {
        const snStockLedgerEntries = __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_getSerialNumberedStockLedgerEntries).call(this, location, isOutward, serialNumbers, quantity);
        this.stockLedgerEntries?.push(...snStockLedgerEntries);
        return;
    }
    if (isOutward) {
        quantity = -quantity;
    }
    const stockLedgerEntry = __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_getStockLedgerEntry).call(this, location, quantity);
    this.stockLedgerEntries?.push(stockLedgerEntry);
}, _StockManagerItem_getSerialNumberedStockLedgerEntries = function _StockManagerItem_getSerialNumberedStockLedgerEntries(location, isOutward, serialNumbers, quantity) {
    if (quantity > 0) {
        quantity = 1;
    }
    if (quantity < 0) {
        quantity = 1;
    }
    else if (isOutward) {
        quantity = -1;
    }
    return serialNumbers.map((sn) => __classPrivateFieldGet(this, _StockManagerItem_instances, "m", _StockManagerItem_getStockLedgerEntry).call(this, location, quantity, sn));
}, _StockManagerItem_getStockLedgerEntry = function _StockManagerItem_getStockLedgerEntry(location, quantity, serialNumber) {
    return this.fyo.doc.getNewDoc(ModelNameEnum.StockLedgerEntry, {
        date: this.date,
        item: this.item,
        rate: this.rate,
        batch: this.batch || null,
        serialNumber: serialNumber || null,
        quantity,
        location,
        referenceName: this.referenceName,
        referenceType: this.referenceType,
    });
}, _StockManagerItem_clear = function _StockManagerItem_clear() {
    this.stockLedgerEntries = [];
};
//# sourceMappingURL=StockManager.js.map