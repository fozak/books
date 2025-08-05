import { LedgerPosting } from 'models/Transactional/LedgerPosting';
import { ModelNameEnum } from 'models/types';
import { getInvoiceActions, getTransactionStatusColumn } from '../../helpers';
import { Invoice } from '../Invoice/Invoice';
export class PurchaseInvoice extends Invoice {
    async getPosting() {
        const exchangeRate = this.exchangeRate ?? 1;
        const posting = new LedgerPosting(this, this.fyo);
        if (this.isReturn) {
            await posting.debit(this.account, this.baseGrandTotal);
        }
        else {
            await posting.credit(this.account, this.baseGrandTotal);
        }
        for (const item of this.items) {
            if (this.isReturn) {
                await posting.credit(item.account, item.amount.mul(exchangeRate));
                continue;
            }
            await posting.debit(item.account, item.amount.mul(exchangeRate));
        }
        if (this.taxes) {
            for (const tax of this.taxes) {
                if (this.isReturn) {
                    await posting.credit(tax.account, tax.amount.mul(exchangeRate));
                    continue;
                }
                await posting.debit(tax.account, tax.amount.mul(exchangeRate));
            }
        }
        const discountAmount = this.getTotalDiscount();
        const discountAccount = this.fyo.singles.AccountingSettings
            ?.discountAccount;
        if (discountAccount && discountAmount.isPositive()) {
            if (this.isReturn) {
                await posting.debit(discountAccount, discountAmount.mul(exchangeRate));
            }
            else {
                await posting.credit(discountAccount, discountAmount.mul(exchangeRate));
            }
        }
        await posting.makeRoundOffEntry();
        return posting;
    }
    static getListViewSettings() {
        return {
            columns: [
                'name',
                getTransactionStatusColumn(),
                'party',
                'date',
                'baseGrandTotal',
                'outstandingAmount',
            ],
        };
    }
    static getActions(fyo) {
        return getInvoiceActions(fyo, ModelNameEnum.PurchaseInvoice);
    }
}
//# sourceMappingURL=PurchaseInvoice.js.map