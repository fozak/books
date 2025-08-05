import { StockQueue } from 'models/inventory/stockQueue';
import { ValuationMethod } from 'models/inventory/types';
import { ModelNameEnum } from 'models/types';
import { safeParseFloat, safeParseInt } from 'utils/index';
export async function getRawStockLedgerEntries(fyo, filters = {}) {
    const fieldnames = [
        'name',
        'date',
        'item',
        'batch',
        'serialNumber',
        'rate',
        'quantity',
        'location',
        'referenceName',
        'referenceType',
    ];
    return (await fyo.db.getAllRaw(ModelNameEnum.StockLedgerEntry, {
        fields: fieldnames,
        filters,
        orderBy: ['date', 'created', 'name'],
        order: 'asc',
    }));
}
export async function getShipmentCOGSAmountFromSLEs(stockTransfer) {
    var _a, _b;
    const fyo = stockTransfer.fyo;
    const date = stockTransfer.date ?? new Date();
    const items = (stockTransfer.items ?? []).filter((i) => i.item);
    const itemNames = Array.from(new Set(items.map((i) => i.item)));
    const rawSles = await getRawStockLedgerEntries(fyo, {
        item: ['in', itemNames],
        date: ['<=', date.toISOString()],
    });
    const q = {};
    for (const sle of rawSles) {
        const i = sle.item;
        const l = sle.location;
        const b = sle.batch ?? '-';
        q[i] ?? (q[i] = {});
        (_a = q[i])[l] ?? (_a[l] = {});
        (_b = q[i][l])[b] ?? (_b[b] = new StockQueue());
        const sq = q[i][l][b];
        if (sle.quantity > 0) {
            const rate = fyo.pesa(sle.rate);
            sq.inward(rate.float, sle.quantity);
        }
        else {
            sq.outward(-sle.quantity);
        }
    }
    let total = fyo.pesa(0);
    for (const item of items) {
        const i = item.item ?? '-';
        const l = item.location ?? '-';
        const b = item.batch ?? '-';
        const stAmount = item.amount ?? 0;
        if (Object.keys(q).length === 0) {
            total = total.add(stAmount);
            continue;
        }
        const sq = q[i][l][b];
        if (!sq) {
            total = total.add(stAmount);
        }
        const stRate = item.rate?.float ?? 0;
        const stQuantity = item.quantity ?? 0;
        const rate = sq.outward(stQuantity) ?? stRate;
        const amount = rate * stQuantity;
        total = total.add(amount);
    }
    return total;
}
export function getStockLedgerEntries(rawSLEs, valuationMethod) {
    var _a, _b;
    const computedSLEs = [];
    const stockQueues = {};
    for (const sle of rawSLEs) {
        const name = safeParseInt(sle.name);
        const date = new Date(sle.date);
        const rate = safeParseFloat(sle.rate);
        const { item, location, quantity, referenceName, referenceType } = sle;
        const batch = sle.batch ?? '';
        const serialNumber = sle.serialNumber ?? '';
        if (quantity === 0) {
            continue;
        }
        stockQueues[item] ?? (stockQueues[item] = {});
        (_a = stockQueues[item])[location] ?? (_a[location] = {});
        (_b = stockQueues[item][location])[batch] ?? (_b[batch] = new StockQueue());
        const q = stockQueues[item][location][batch];
        const initialValue = q.value;
        let incomingRate;
        if (quantity > 0) {
            incomingRate = q.inward(rate, quantity);
        }
        else {
            incomingRate = q.outward(-quantity);
        }
        if (incomingRate === null) {
            continue;
        }
        const balanceQuantity = q.quantity;
        let valuationRate = q.fifo;
        if (valuationMethod === ValuationMethod.MovingAverage) {
            valuationRate = q.movingAverage;
        }
        const balanceValue = q.value;
        const valueChange = balanceValue - initialValue;
        const csle = {
            name,
            date,
            item,
            location,
            batch,
            serialNumber,
            quantity,
            balanceQuantity,
            incomingRate,
            valuationRate,
            balanceValue,
            valueChange,
            referenceName,
            referenceType,
        };
        computedSLEs.push(csle);
    }
    return computedSLEs;
}
export function getStockBalanceEntries(computedSLEs, filters) {
    var _a, _b, _c, _d;
    const sbeMap = {};
    const fromDate = filters.fromDate ? Date.parse(filters.fromDate) : null;
    const toDate = filters.toDate ? Date.parse(filters.toDate) : null;
    for (const sle of computedSLEs) {
        if (filters.item && sle.item !== filters.item) {
            continue;
        }
        if (filters.location && sle.location !== filters.location) {
            continue;
        }
        if (filters.batch && sle.batch !== filters.batch) {
            continue;
        }
        const batch = sle.batch || '';
        sbeMap[_a = sle.item] ?? (sbeMap[_a] = {});
        (_b = sbeMap[sle.item])[_c = sle.location] ?? (_b[_c] = {});
        (_d = sbeMap[sle.item][sle.location])[batch] ?? (_d[batch] = getSBE(sle.item, sle.location, batch));
        const date = sle.date.valueOf();
        if (fromDate && date < fromDate) {
            const sbe = sbeMap[sle.item][sle.location][batch];
            updateOpeningBalances(sbe, sle);
            continue;
        }
        if (toDate && date > toDate) {
            continue;
        }
        const sbe = sbeMap[sle.item][sle.location][batch];
        updateCurrentBalances(sbe, sle);
    }
    return Object.values(sbeMap)
        .map((sbeBatched) => Object.values(sbeBatched).map((sbes) => Object.values(sbes)))
        .flat(2);
}
function getSBE(item, location, batch) {
    return {
        name: 0,
        item,
        location,
        batch,
        balanceQuantity: 0,
        balanceValue: 0,
        openingQuantity: 0,
        openingValue: 0,
        incomingQuantity: 0,
        incomingValue: 0,
        outgoingQuantity: 0,
        outgoingValue: 0,
        valuationRate: 0,
    };
}
function updateOpeningBalances(sbe, sle) {
    sbe.openingQuantity += sle.quantity;
    sbe.openingValue += sle.valueChange;
    sbe.balanceQuantity += sle.quantity;
    sbe.balanceValue += sle.valueChange;
}
function updateCurrentBalances(sbe, sle) {
    sbe.balanceQuantity += sle.quantity;
    sbe.balanceValue += sle.valueChange;
    if (sle.quantity > 0) {
        sbe.incomingQuantity += sle.quantity;
        sbe.incomingValue += sle.valueChange;
    }
    else {
        sbe.outgoingQuantity -= sle.quantity;
        sbe.outgoingValue -= sle.valueChange;
    }
    sbe.valuationRate = sle.valuationRate;
}
//# sourceMappingURL=helpers.js.map