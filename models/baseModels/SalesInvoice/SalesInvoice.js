import { t } from 'fyo';
import { LedgerPosting } from 'models/Transactional/LedgerPosting';
import { ModelNameEnum } from 'models/types';
import { getAddedLPWithGrandTotal, getInvoiceActions, getReturnLoyaltyPoints, getTransactionStatusColumn, } from '../../helpers';
import { Invoice } from '../Invoice/Invoice';
import { ValidationError } from 'fyo/utils/errors';
export class SalesInvoice extends Invoice {
    constructor() {
        super(...arguments);
        this.validations = {
            loyaltyPoints: async (value) => {
                if (!this.redeemLoyaltyPoints || this.isSubmitted || this.isReturn) {
                    return;
                }
                const partyDoc = (await this.fyo.doc.getDoc(ModelNameEnum.Party, this.party));
                if (value <= 0) {
                    throw new ValidationError(t `Points must be greather than 0`);
                }
                if (value > (partyDoc?.loyaltyPoints || 0)) {
                    throw new ValidationError(t `${this.party} only has ${partyDoc.loyaltyPoints} points`);
                }
                const loyaltyProgramDoc = (await this.fyo.doc.getDoc(ModelNameEnum.LoyaltyProgram, this.loyaltyProgram));
                if (!this?.grandTotal) {
                    return;
                }
                const loyaltyPoint = (value || 0) *
                    (loyaltyProgramDoc?.conversionFactor || 0);
                if (!this.isReturn) {
                    const totalDiscount = this.getTotalDiscount();
                    let baseGrandTotal;
                    if (!this.taxes.length) {
                        baseGrandTotal = this.netTotal.sub(totalDiscount);
                    }
                    else {
                        baseGrandTotal = (this.taxes ?? [])
                            .map((doc) => doc.amount)
                            .reduce((a, b) => {
                            if (this.isReturn) {
                                return a.abs().add(b.abs()).neg();
                            }
                            return a.add(b.abs());
                        }, this.netTotal.abs())
                            .sub(totalDiscount);
                    }
                    if (baseGrandTotal?.lt(loyaltyPoint)) {
                        throw new ValidationError(t `no need ${value} points to purchase this item`);
                    }
                }
            },
        };
    }
    async getPosting() {
        const exchangeRate = this.exchangeRate ?? 1;
        const posting = new LedgerPosting(this, this.fyo);
        if (this.isReturn) {
            await posting.credit(this.account, this.baseGrandTotal);
        }
        else {
            await posting.debit(this.account, this.baseGrandTotal);
        }
        for (const item of this.items) {
            if (this.isReturn) {
                await posting.debit(item.account, item.amount.mul(exchangeRate));
                continue;
            }
            await posting.credit(item.account, item.amount.mul(exchangeRate));
        }
        if (this.redeemLoyaltyPoints) {
            const loyaltyProgramDoc = (await this.fyo.doc.getDoc(ModelNameEnum.LoyaltyProgram, this.loyaltyProgram));
            let totalAmount;
            if (this.isReturn) {
                totalAmount = this.fyo.pesa(await getReturnLoyaltyPoints(this));
            }
            else {
                totalAmount = await getAddedLPWithGrandTotal(this.fyo, this.loyaltyProgram, this.loyaltyPoints);
            }
            await posting.debit(loyaltyProgramDoc.expenseAccount, totalAmount);
            await posting.credit(this.account, totalAmount);
        }
        if (this.taxes) {
            for (const tax of this.taxes) {
                if (this.isReturn) {
                    await posting.debit(tax.account, tax.amount.mul(exchangeRate));
                    continue;
                }
                await posting.credit(tax.account, tax.amount.mul(exchangeRate));
            }
        }
        const discountAmount = this.getTotalDiscount();
        const discountAccount = this.fyo.singles.AccountingSettings
            ?.discountAccount;
        if (discountAccount && discountAmount.isPositive()) {
            if (this.isReturn) {
                await posting.credit(discountAccount, discountAmount.mul(exchangeRate));
            }
            else {
                await posting.debit(discountAccount, discountAmount.mul(exchangeRate));
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
        return getInvoiceActions(fyo, ModelNameEnum.SalesInvoice);
    }
}
//# sourceMappingURL=SalesInvoice.js.map