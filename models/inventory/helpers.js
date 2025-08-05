import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import { SerialNumber } from './SerialNumber';
export async function validateBatch(doc) {
    for (const row of doc.items ?? []) {
        await validateItemRowBatch(row);
    }
}
async function validateItemRowBatch(doc) {
    const idx = doc.idx ?? 0;
    const item = doc.item;
    const batch = doc.batch;
    if (!item) {
        return;
    }
    const hasBatch = await doc.fyo.getValue(ModelNameEnum.Item, item, 'hasBatch');
    if (!hasBatch && batch) {
        throw new ValidationError([
            doc.fyo.t `Batch set for row ${idx + 1}.`,
            doc.fyo.t `Item ${item} is not a batched item`,
        ].join(' '));
    }
    if (hasBatch && !batch) {
        throw new ValidationError([
            doc.fyo.t `Batch not set for row ${idx + 1}.`,
            doc.fyo.t `Item ${item} is a batched item`,
        ].join(' '));
    }
}
export async function validateSerialNumber(doc) {
    if (doc.isCancelled) {
        return;
    }
    for (const row of doc.items ?? []) {
        await validateItemRowSerialNumber(row);
    }
}
async function validateItemRowSerialNumber(row) {
    const idx = row.idx ?? 0;
    const item = row.item;
    if (!item) {
        return;
    }
    const hasSerialNumber = await row.fyo.getValue(ModelNameEnum.Item, item, 'hasSerialNumber');
    if (hasSerialNumber && !row.serialNumber) {
        throw new ValidationError([
            row.fyo.t `Serial Number not set for row ${idx + 1}.`,
            row.fyo.t `Serial Number is enabled for Item ${item}`,
        ].join(' '));
    }
    if (!hasSerialNumber && row.serialNumber) {
        throw new ValidationError([
            row.fyo.t `Serial Number set for row ${idx + 1}.`,
            row.fyo.t `Serial Number is not enabled for Item ${item}`,
        ].join(' '));
    }
    const serialNumber = row.serialNumber;
    if (!hasSerialNumber || typeof serialNumber !== 'string') {
        return;
    }
    const serialNumbers = getSerialNumbers(serialNumber);
    const quantity = Math.abs(row.quantity ?? 0);
    if (serialNumbers.length !== quantity) {
        throw new ValidationError(t `Additional ${quantity - serialNumbers.length} Serial Numbers required for ${quantity} quantity of ${item}.`);
    }
    const nonExistingIncomingSerialNumbers = [];
    for (const serialNumber of serialNumbers) {
        if (await row.fyo.db.exists(ModelNameEnum.SerialNumber, serialNumber)) {
            continue;
        }
        if (isSerialNumberIncoming(row)) {
            nonExistingIncomingSerialNumbers.push(serialNumber);
            continue;
        }
        throw new ValidationError(t `Serial Number ${serialNumber} does not exist.`);
    }
    for (const serialNumber of serialNumbers) {
        if (nonExistingIncomingSerialNumbers.includes(serialNumber)) {
            continue;
        }
        const snDoc = await row.fyo.doc.getDoc(ModelNameEnum.SerialNumber, serialNumber);
        if (!(snDoc instanceof SerialNumber)) {
            continue;
        }
        if (snDoc.item !== item) {
            throw new ValidationError(t `Serial Number ${serialNumber} does not belong to the item ${item}.`);
        }
        const status = snDoc.status ?? 'Inactive';
        const schemaName = row.parentSchemaName;
        const isReturn = !!row.parentdoc?.returnAgainst;
        const isSubmitted = !!row.parentdoc?.submitted;
        if (schemaName === 'PurchaseReceipt' &&
            status !== 'Inactive' &&
            !isSubmitted &&
            !isReturn) {
            throw new ValidationError(t `Serial Number ${serialNumber} is not Inactive`);
        }
        if (schemaName === 'Shipment' &&
            status !== 'Active' &&
            !isSubmitted &&
            !isReturn) {
            throw new ValidationError(t `Serial Number ${serialNumber} is not Active.`);
        }
    }
}
export function getSerialNumbers(serialNumber) {
    if (!serialNumber) {
        return [];
    }
    return serialNumber
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}
export function getSerialNumberFromDoc(doc) {
    if (!doc.items?.length) {
        return [];
    }
    return doc.items
        .map((item) => getSerialNumbers(item.serialNumber ?? '').map((serialNumber) => ({
        serialNumber,
        item,
    })))
        .flat()
        .filter(Boolean);
}
export async function createSerialNumbers(doc) {
    const items = doc.items ?? [];
    const serialNumberCreateList = items
        .map((item) => {
        const serialNumbers = getSerialNumbers(item.serialNumber ?? '');
        return serialNumbers.map((serialNumber) => ({
            item: item.item ?? '',
            serialNumber,
            isIncoming: isSerialNumberIncoming(item),
        }));
    })
        .flat()
        .filter(({ item, isIncoming }) => isIncoming && item);
    for (const { item, serialNumber } of serialNumberCreateList) {
        if (await doc.fyo.db.exists(ModelNameEnum.SerialNumber, serialNumber)) {
            continue;
        }
        const snDoc = doc.fyo.doc.getNewDoc(ModelNameEnum.SerialNumber, {
            name: serialNumber,
            item,
        });
        const status = 'Active';
        await snDoc.set('status', status);
        await snDoc.sync();
    }
}
function isSerialNumberIncoming(item) {
    if (item.parentdoc?.schemaName === ModelNameEnum.Shipment) {
        return false;
    }
    if (item.parentdoc?.schemaName === ModelNameEnum.PurchaseReceipt) {
        return true;
    }
    return !!item.toLocation && !item.fromLocation;
}
export async function canValidateSerialNumber(item, serialNumber) {
    if (!isSerialNumberIncoming(item)) {
        return true;
    }
    return await item.fyo.db.exists(ModelNameEnum.SerialNumber, serialNumber);
}
export async function updateSerialNumbers(doc, isCancel, isReturn = false) {
    for (const row of doc.items ?? []) {
        if (!row.serialNumber) {
            continue;
        }
        const status = getSerialNumberStatus(doc, row, isCancel, isReturn);
        await updateSerialNumberStatus(status, row.serialNumber, doc.fyo);
    }
}
async function updateSerialNumberStatus(status, serialNumber, fyo) {
    for (const name of getSerialNumbers(serialNumber)) {
        const doc = await fyo.doc.getDoc(ModelNameEnum.SerialNumber, name);
        await doc.setAndSync('status', status);
    }
}
function getSerialNumberStatus(doc, item, isCancel, isReturn) {
    if (doc.schemaName === ModelNameEnum.Shipment) {
        if (isReturn) {
            return isCancel ? 'Delivered' : 'Active';
        }
        return isCancel ? 'Active' : 'Delivered';
    }
    if (doc.schemaName === ModelNameEnum.PurchaseReceipt) {
        if (isReturn) {
            return isCancel ? 'Active' : 'Delivered';
        }
        return isCancel ? 'Inactive' : 'Active';
    }
    return getSerialNumberStatusForStockMovement(doc, item, isCancel);
}
function getSerialNumberStatusForStockMovement(doc, item, isCancel) {
    if (doc.movementType === 'MaterialIssue') {
        return isCancel ? 'Active' : 'Delivered';
    }
    if (doc.movementType === 'MaterialReceipt') {
        return isCancel ? 'Inactive' : 'Active';
    }
    if (doc.movementType === 'MaterialTransfer') {
        return 'Active';
    }
    // MovementType is Manufacture
    if (item.fromLocation) {
        return isCancel ? 'Active' : 'Delivered';
    }
    return isCancel ? 'Inactive' : 'Active';
}
//# sourceMappingURL=helpers.js.map