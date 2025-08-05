import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
export class AccountingLedgerEntry extends Doc {
    async revert() {
        if (this.reverted) {
            return;
        }
        await this.set('reverted', true);
        const revertedEntry = this.fyo.doc.getNewDoc(ModelNameEnum.AccountingLedgerEntry, {
            account: this.account,
            party: this.party,
            date: new Date(),
            referenceType: this.referenceType,
            referenceName: this.referenceName,
            debit: this.credit,
            credit: this.debit,
            reverted: true,
            reverts: this.name,
        });
        await this.sync();
        await revertedEntry.sync();
    }
    static getListViewSettings() {
        return {
            columns: ['date', 'account', 'party', 'debit', 'credit', 'referenceName'],
        };
    }
}
//# sourceMappingURL=AccountingLedgerEntry.js.map