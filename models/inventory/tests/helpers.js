import { ModelNameEnum } from 'models/types';
export function getItem(name, rate, hasBatch = false, hasSerialNumber = false) {
    return { name, rate, trackItem: true, hasBatch, hasSerialNumber };
}
export function getBatch(schemaName, batch, expiryDate, manufactureDate, fyo) {
    const doc = fyo.doc.getNewDoc(schemaName, {
        batch,
        expiryDate,
        manufactureDate,
    });
    return doc;
}
export async function getStockTransfer(schemaName, party, date, transfers, fyo) {
    const doc = fyo.doc.getNewDoc(schemaName, { party, date });
    for (const { item, location, quantity, rate } of transfers) {
        await doc.append('items', { item, location, quantity, rate });
    }
    return doc;
}
export async function getStockMovement(movementType, date, transfers, fyo) {
    const doc = fyo.doc.getNewDoc(ModelNameEnum.StockMovement, {
        movementType,
        date,
    });
    for (const { item, from: fromLocation, to: toLocation, batch, serialNumber, quantity, rate, } of transfers) {
        await doc.append('items', {
            item,
            fromLocation,
            toLocation,
            batch,
            serialNumber,
            rate,
            quantity,
        });
    }
    return doc;
}
export async function getSLEs(referenceName, referenceType, fyo) {
    return (await fyo.db.getAllRaw(ModelNameEnum.StockLedgerEntry, {
        filters: { referenceName, referenceType },
        fields: ['date', 'name', 'item', 'location', 'rate', 'quantity'],
    }));
}
export async function getALEs(referenceName, referenceType, fyo) {
    return (await fyo.db.getAllRaw(ModelNameEnum.AccountingLedgerEntry, {
        filters: { referenceName, referenceType },
        fields: ['date', 'account', 'party', 'debit', 'credit', 'reverted'],
    }));
}
//# sourceMappingURL=helpers.js.map