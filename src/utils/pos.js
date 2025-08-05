import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { AccountTypeEnum } from 'models/baseModels/Account/types';
import { ModelNameEnum } from 'models/types';
import { fyo } from 'src/initFyo';
import { safeParseFloat } from 'utils/index';
import { showToast } from './interactive';
export async function getPOSOpeningShiftDoc(fyo) {
    const existingShiftDoc = await fyo.db.getAll(ModelNameEnum.POSOpeningShift, {
        limit: 1,
        orderBy: 'created',
        fields: ['name'],
    });
    if (!fyo.singles.POSSettings?.isShiftOpen || !existingShiftDoc) {
        return fyo.doc.getNewDoc(ModelNameEnum.POSOpeningShift);
    }
    return (await fyo.doc.getDoc(ModelNameEnum.POSOpeningShift, existingShiftDoc[0].name));
}
export function getTotalQuantity(items) {
    let totalQuantity = safeParseFloat(0);
    if (!items.length) {
        return totalQuantity;
    }
    for (const item of items) {
        const quantity = item.quantity ?? 0;
        totalQuantity = safeParseFloat(totalQuantity + quantity);
    }
    return totalQuantity;
}
export function getItemDiscounts(items) {
    let itemDiscounts = fyo.pesa(0);
    if (!items.length) {
        return itemDiscounts;
    }
    for (const item of items) {
        if (item.setItemDiscountAmount) {
            if (!item.itemDiscountAmount?.isZero()) {
                itemDiscounts = itemDiscounts.add(item.itemDiscountAmount.mul(item.quantity));
            }
        }
        else {
            if (item.amount && item.itemDiscountPercent > 1) {
                itemDiscounts = itemDiscounts.add(item.amount.percent(item.itemDiscountPercent));
            }
        }
    }
    return itemDiscounts;
}
export async function getItem(item) {
    const itemDoc = (await fyo.doc.getDoc(ModelNameEnum.Item, item));
    if (!itemDoc) {
        return;
    }
    return itemDoc;
}
export async function validateSinv(sinvDoc, itemQtyMap) {
    if (!sinvDoc) {
        return;
    }
    await validateSinvItems(sinvDoc.items, itemQtyMap, sinvDoc.returnAgainst);
}
async function validateSinvItems(sinvItems, itemQtyMap, isReturn) {
    for (const item of sinvItems) {
        const trackItem = await fyo.getValue(ModelNameEnum.Item, item.item, 'trackItem');
        if (!trackItem) {
            return;
        }
        if (!item.quantity || (item.quantity < 1 && !isReturn)) {
            throw new ValidationError(t `Invalid Quantity for Item ${item.item}`);
        }
        if (!itemQtyMap[item.item]) {
            throw new ValidationError(t `Item ${item.item} not in Stock`);
        }
        if (item.quantity > itemQtyMap[item.item].availableQty) {
            throw new ValidationError(t `Insufficient Quantity. Item ${item.item} has only ${itemQtyMap[item.item].availableQty} quantities available. you selected ${item.quantity}`);
        }
    }
}
export async function validateShipment(itemSerialNumbers) {
    if (!itemSerialNumbers) {
        return;
    }
    for (const idx in itemSerialNumbers) {
        const serialNumbers = itemSerialNumbers[idx].split('\n');
        for (const serialNumber of serialNumbers) {
            const status = await fyo.getValue(ModelNameEnum.SerialNumber, serialNumber, 'status');
            if (status !== 'Active') {
                throw new ValidationError(t `Serial Number ${serialNumber} status is not Active.`);
            }
        }
    }
}
export function validateIsPosSettingsSet(fyo) {
    try {
        const inventory = fyo.singles.POSSettings?.inventory;
        if (!inventory) {
            throw new ValidationError(t `POS Inventory is not set. Please set it on POS Settings`);
        }
        const cashAccount = fyo.singles.POSSettings?.cashAccount;
        if (!cashAccount) {
            throw new ValidationError(t `POS Counter Cash Account is not set. Please set it on POS Settings`);
        }
        const writeOffAccount = fyo.singles.POSSettings?.writeOffAccount;
        if (!writeOffAccount) {
            throw new ValidationError(t `POS Write Off Account is not set. Please set it on POS Settings`);
        }
    }
    catch (error) {
        showToast({
            type: 'error',
            message: t `${error}`,
            duration: 'long',
        });
    }
}
export function getTotalTaxedAmount(sinvDoc) {
    let totalTaxedAmount = fyo.pesa(0);
    if (!sinvDoc.items?.length || !sinvDoc.taxes?.length) {
        return totalTaxedAmount;
    }
    for (const row of sinvDoc.taxes) {
        totalTaxedAmount = totalTaxedAmount.add(row.amount);
    }
    return totalTaxedAmount;
}
export function validateClosingAmounts(posShiftDoc) {
    try {
        if (!posShiftDoc) {
            throw new ValidationError(`POS Shift Document not loaded. Please reload.`);
        }
        posShiftDoc.closingAmounts?.map((row) => {
            if (row.closingAmount?.isNegative()) {
                throw new ValidationError(t `Closing ${row.paymentMethod} Amount can not be negative.`);
            }
        });
    }
    catch (error) { }
}
export async function transferPOSCashAndWriteOff(fyo, posShiftDoc) {
    const expectedCashAmount = posShiftDoc.closingAmounts?.find((row) => row.paymentMethod === 'Cash')?.expectedAmount;
    if (expectedCashAmount.isZero()) {
        return;
    }
    const closingCashAmount = posShiftDoc.closingAmounts?.find((row) => row.paymentMethod === 'Cash')?.closingAmount;
    const jvDoc = fyo.doc.getNewDoc(ModelNameEnum.JournalEntry, {
        entryType: 'Journal Entry',
    });
    await jvDoc.append('accounts', {
        account: AccountTypeEnum.Cash,
        debit: closingCashAmount,
    });
    await jvDoc.append('accounts', {
        account: fyo.singles.POSSettings?.cashAccount,
        credit: closingCashAmount,
    });
    const differenceAmount = posShiftDoc?.closingAmounts?.find((row) => row.paymentMethod === 'Cash')?.differenceAmount;
    if (differenceAmount.isNegative()) {
        await jvDoc.append('accounts', {
            account: AccountTypeEnum.Cash,
            debit: differenceAmount.abs(),
            credit: fyo.pesa(0),
        });
        await jvDoc.append('accounts', {
            account: fyo.singles.POSSettings?.writeOffAccount,
            debit: fyo.pesa(0),
            credit: differenceAmount.abs(),
        });
    }
    if (!differenceAmount.isZero() && differenceAmount.isPositive()) {
        await jvDoc.append('accounts', {
            account: fyo.singles.POSSettings?.writeOffAccount,
            debit: differenceAmount,
            credit: fyo.pesa(0),
        });
        await jvDoc.append('accounts', {
            account: AccountTypeEnum.Cash,
            debit: fyo.pesa(0),
            credit: differenceAmount,
        });
    }
    await (await jvDoc.sync()).submit();
}
export function validateSerialNumberCount(serialNumbers, quantity, item) {
    let serialNumberCount = 0;
    if (serialNumbers) {
        serialNumberCount = serialNumbers.split('\n').length;
    }
    if (Math.abs(quantity) !== serialNumberCount) {
        const errorMessage = t `Need ${quantity} Serial Numbers for Item ${item}. You have provided ${serialNumberCount}`;
        showToast({
            type: 'error',
            message: errorMessage,
            duration: 'long',
        });
        throw new ValidationError(errorMessage);
    }
}
//# sourceMappingURL=pos.js.map