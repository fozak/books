import { Doc } from 'fyo/model/doc';
export class JournalEntryAccount extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            debit: {
                formula: () => this.getAutoDebitCredit('debit'),
            },
            credit: {
                formula: () => this.getAutoDebitCredit('credit'),
            },
        };
    }
    getAutoDebitCredit(type) {
        const currentValue = this.get(type);
        if (!currentValue.isZero()) {
            return;
        }
        const otherType = type === 'debit' ? 'credit' : 'debit';
        const otherTypeValue = this.get(otherType);
        if (!otherTypeValue.isZero()) {
            return this.fyo.pesa(0);
        }
        const totalType = this.parentdoc.getSum('accounts', type, false);
        const totalOtherType = this.parentdoc.getSum('accounts', otherType, false);
        if (totalType.lt(totalOtherType)) {
            return totalOtherType.sub(totalType);
        }
    }
}
JournalEntryAccount.filters = {
    account: () => ({ isGroup: false }),
};
//# sourceMappingURL=JournalEntryAccount.js.map