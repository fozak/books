var _a, _BespokeQueries_getDocItemMap, _BespokeQueries_getReturnBalanceItemQtyMap;
import { __classPrivateFieldGet } from "tslib";
import { ModelNameEnum } from '../../models/types';
import { safeParseFloat } from 'utils/index';
export class BespokeQueries {
    static async getLastInserted(db, schemaName) {
        const lastInserted = (await db.knex.raw('select cast(name as int) as num from ?? order by num desc limit 1', [schemaName]));
        const num = lastInserted?.[0]?.num;
        if (num === undefined) {
            return 0;
        }
        return num;
    }
    static async getTopExpenses(db, fromDate, toDate) {
        const expenseAccounts = db
            .knex.select('name')
            .from('Account')
            .where('rootType', 'Expense');
        const topExpenses = await db
            .knex.select({
            total: db.knex.raw('sum(cast(debit as real) - cast(credit as real))'),
        })
            .select('account')
            .from('AccountingLedgerEntry')
            .where('reverted', false)
            .where('account', 'in', expenseAccounts)
            .whereBetween('date', [fromDate, toDate])
            .groupBy('account')
            .orderBy('total', 'desc')
            .limit(5);
        return topExpenses;
    }
    static async getTotalOutstanding(db, schemaName, fromDate, toDate) {
        return (await db.knex(schemaName)
            .sum({ total: 'baseGrandTotal' })
            .sum({ outstanding: 'outstandingAmount' })
            .where('submitted', true)
            .where('cancelled', false)
            .whereBetween('date', [fromDate, toDate])
            .first());
    }
    static async getCashflow(db, fromDate, toDate) {
        const cashAndBankAccounts = db.knex('Account')
            .select('name')
            .where('accountType', 'in', ['Cash', 'Bank'])
            .andWhere('isGroup', false);
        const dateAsMonthYear = db.knex.raw(`strftime('%Y-%m', ??)`, 'date');
        return (await db.knex('AccountingLedgerEntry')
            .where('reverted', false)
            .sum({
            inflow: 'debit',
            outflow: 'credit',
        })
            .select({
            yearmonth: dateAsMonthYear,
        })
            .where('account', 'in', cashAndBankAccounts)
            .whereBetween('date', [fromDate, toDate])
            .groupBy(dateAsMonthYear));
    }
    static async getIncomeAndExpenses(db, fromDate, toDate) {
        const income = (await db.knex.raw(`
      select sum(cast(credit as real) - cast(debit as real)) as balance, strftime('%Y-%m', date) as yearmonth
      from AccountingLedgerEntry
      where
        reverted = false and
        date between date(?) and date(?) and
        account in (
          select name
          from Account
          where rootType = 'Income'
        )
      group by yearmonth`, [fromDate, toDate]));
        const expense = (await db.knex.raw(`
      select sum(cast(debit as real) - cast(credit as real)) as balance, strftime('%Y-%m', date) as yearmonth
      from AccountingLedgerEntry
      where
        reverted = false and
        date between date(?) and date(?) and
        account in (
          select name
          from Account
          where rootType = 'Expense'
        )
      group by yearmonth`, [fromDate, toDate]));
        return { income, expense };
    }
    static async getTotalCreditAndDebit(db) {
        return (await db.knex.raw(`
    select 
	    account, 
      sum(cast(credit as real)) as totalCredit, 
      sum(cast(debit as real)) as totalDebit
    from AccountingLedgerEntry
    group by account
    `));
    }
    static async getStockQuantity(db, item, location, fromDate, toDate, batch, serialNumbers) {
        /* eslint-disable @typescript-eslint/no-floating-promises */
        const query = db.knex(ModelNameEnum.StockLedgerEntry)
            .sum('quantity')
            .where('item', item);
        if (location) {
            query.andWhere('location', location);
        }
        if (batch) {
            query.andWhere('batch', batch);
        }
        if (serialNumbers?.length) {
            query.andWhere('serialNumber', 'in', serialNumbers);
        }
        if (fromDate) {
            query.andWhereRaw('datetime(date) > datetime(?)', [fromDate]);
        }
        if (toDate) {
            query.andWhereRaw('datetime(date) < datetime(?)', [toDate]);
        }
        const value = (await query);
        if (!value.length) {
            return null;
        }
        return value[0][Object.keys(value[0])[0]];
    }
    static async getReturnBalanceItemsQty(db, schemaName, docName) {
        const returnDocNames = (await db.knex(schemaName)
            .select('name')
            .where('returnAgainst', docName)
            .andWhere('submitted', true)
            .andWhere('cancelled', false)).map((i) => i.name);
        if (!returnDocNames.length) {
            return;
        }
        const returnedItemsQuery = db.knex(`${schemaName}Item`)
            .sum({ quantity: 'quantity' })
            .whereIn('parent', returnDocNames);
        const docItemsQuery = db.knex(`${schemaName}Item`)
            .where('parent', docName)
            .sum({ quantity: 'quantity' });
        if ([ModelNameEnum.SalesInvoice, ModelNameEnum.PurchaseInvoice].includes(schemaName)) {
            returnedItemsQuery.select('item', 'batch').groupBy('item', 'batch');
            docItemsQuery.select('name', 'item', 'batch').groupBy('item', 'batch');
        }
        if ([ModelNameEnum.Shipment, ModelNameEnum.PurchaseReceipt].includes(schemaName)) {
            returnedItemsQuery
                .select('item', 'batch', 'serialNumber')
                .groupBy('item', 'batch', 'serialNumber');
            docItemsQuery
                .select('name', 'item', 'batch', 'serialNumber')
                .groupBy('item', 'batch', 'serialNumber');
        }
        const returnedItems = (await returnedItemsQuery);
        if (!returnedItems.length) {
            return;
        }
        const docItems = (await docItemsQuery);
        const docItemsMap = __classPrivateFieldGet(_a, _a, "m", _BespokeQueries_getDocItemMap).call(_a, docItems);
        const returnedItemsMap = __classPrivateFieldGet(_a, _a, "m", _BespokeQueries_getDocItemMap).call(_a, returnedItems);
        const returnBalanceItems = __classPrivateFieldGet(_a, _a, "m", _BespokeQueries_getReturnBalanceItemQtyMap).call(_a, docItemsMap, returnedItemsMap);
        return returnBalanceItems;
    }
    static async getPOSTransactedAmount(db, fromDate, toDate, lastShiftClosingDate) {
        const sinvNamesQuery = db.knex(ModelNameEnum.SalesInvoice)
            .select('name')
            .where('isPOS', true)
            .andWhereBetween('date', [fromDate.toISOString(), toDate.toISOString()]);
        if (lastShiftClosingDate) {
            sinvNamesQuery.andWhere('created', '>', lastShiftClosingDate.toISOString());
        }
        const sinvNames = (await sinvNamesQuery).map((row) => row.name);
        if (!sinvNames.length) {
            return;
        }
        const paymentEntryNames = (await db.knex(ModelNameEnum.PaymentFor)
            .select('parent')
            .whereIn('referenceName', sinvNames)).map((doc) => doc.parent);
        const groupedAmounts = (await db.knex(ModelNameEnum.Payment)
            .select('paymentMethod')
            .whereIn('name', paymentEntryNames)
            .groupBy('paymentMethod')
            .sum({ amount: 'amount' }));
        const transactedAmounts = {};
        if (!groupedAmounts) {
            return;
        }
        for (const row of groupedAmounts) {
            transactedAmounts[row.paymentMethod] = row.amount;
        }
        return transactedAmounts;
    }
}
_a = BespokeQueries, _BespokeQueries_getDocItemMap = function _BespokeQueries_getDocItemMap(docItems) {
    const docItemsMap = {};
    const batchesMap = {};
    for (const item of docItems) {
        if (!!docItemsMap[item.item]) {
            if (item.batch) {
                let serialNumbers;
                if (!docItemsMap[item.item].batches[item.batch]) {
                    docItemsMap[item.item].batches[item.batch] = {
                        quantity: item.quantity,
                        serialNumbers,
                    };
                }
                else {
                    docItemsMap[item.item].batches[item.batch] = {
                        quantity: (docItemsMap[item.item].batches[item.batch].quantity +=
                            item.quantity),
                        serialNumbers,
                    };
                }
            }
            else {
                docItemsMap[item.item].quantity += item.quantity;
            }
            if (item.serialNumber) {
                const serialNumbers = [];
                if (docItemsMap[item.item].serialNumbers) {
                    serialNumbers.push(...(docItemsMap[item.item].serialNumbers ?? []));
                }
                serialNumbers.push(...item.serialNumber.split('\n'));
                docItemsMap[item.item].serialNumbers = serialNumbers;
            }
            continue;
        }
        if (item.batch) {
            let serialNumbers = undefined;
            if (item.serialNumber) {
                serialNumbers = item.serialNumber.split('\n');
            }
            batchesMap[item.batch] = {
                serialNumbers,
                quantity: item.quantity,
            };
        }
        let serialNumbers = undefined;
        if (!item.batch && item.serialNumber) {
            serialNumbers = item.serialNumber.split('\n');
        }
        docItemsMap[item.item] = {
            serialNumbers,
            batches: batchesMap,
            quantity: item.quantity,
        };
    }
    return docItemsMap;
}, _BespokeQueries_getReturnBalanceItemQtyMap = function _BespokeQueries_getReturnBalanceItemQtyMap(docItemsMap, returnedItemsMap) {
    const returnBalanceItems = {};
    const balanceBatchQtyMap = {};
    for (const row in docItemsMap) {
        const balanceSerialNumbersMap = [];
        let balanceQty = safeParseFloat(-docItemsMap[row].quantity);
        const docItem = docItemsMap[row];
        const returnedDocItem = returnedItemsMap[row];
        const docItemHasBatch = !!Object.keys(docItem.batches ?? {}).length;
        if (returnedItemsMap) {
            for (const item in returnedItemsMap) {
                if (docItemHasBatch && item !== row) {
                    continue;
                }
                balanceQty = -(Math.abs(balanceQty) + returnedItemsMap[item].quantity);
                const returnedItem = returnedItemsMap[item];
                if (docItem.serialNumbers && returnedItem.serialNumbers) {
                    for (const serialNumber of docItem.serialNumbers) {
                        if (!returnedItem.serialNumbers.includes(serialNumber)) {
                            balanceSerialNumbersMap.push(serialNumber);
                        }
                    }
                }
            }
        }
        if (docItemHasBatch && docItem.batches) {
            for (const batch in docItem.batches) {
                const docItemSerialNumbers = docItem.batches[batch].serialNumbers;
                const itemSerialNumbers = docItem.batches[batch].serialNumbers;
                let balanceSerialNumbers;
                if (docItemSerialNumbers && itemSerialNumbers) {
                    balanceSerialNumbers = docItemSerialNumbers.filter((serialNumber) => itemSerialNumbers.indexOf(serialNumber) == -1);
                }
                const ItemQty = Math.abs(docItem.batches[batch].quantity);
                let balanceQty = safeParseFloat(-ItemQty);
                if (!returnedDocItem || !returnedDocItem?.batches) {
                    continue;
                }
                const returnedItem = returnedDocItem?.batches[batch];
                if (!returnedItem) {
                    balanceBatchQtyMap[batch] = {
                        quantity: balanceQty,
                        serialNumbers: balanceSerialNumbers,
                    };
                    continue;
                }
                balanceQty = -(Math.abs(safeParseFloat(-ItemQty)) -
                    Math.abs(returnedDocItem.batches[batch].quantity));
                balanceBatchQtyMap[batch] = {
                    quantity: balanceQty,
                    serialNumbers: balanceSerialNumbers,
                };
            }
        }
        returnBalanceItems[row] = {
            quantity: balanceQty,
            batches: balanceBatchQtyMap,
            serialNumbers: balanceSerialNumbersMap,
        };
    }
    return returnBalanceItems;
};
//# sourceMappingURL=bespoke.js.map