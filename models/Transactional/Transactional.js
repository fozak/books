import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
/**
 * # Transactional
 *
 * Any model that creates ledger entries on submit should extend the
 * `Transactional` model.
 *
 * Example of transactional models:
 * - Invoice
 * - Payment
 * - JournalEntry
 *
 * Basically it does the following:
 * - `afterSubmit`: create the ledger entries.
 * - `afterCancel`: create reverse ledger entries.
 * - `afterDelete`: delete the normal and reversed ledger entries.
 */
export class Transactional extends Doc {
    get isTransactional() {
        return true;
    }
    async validate() {
        await super.validate();
        if (!this.isTransactional) {
            return;
        }
        const posting = await this.getPosting();
        if (posting === null) {
            return;
        }
        posting.validate();
    }
    async afterSubmit() {
        await super.afterSubmit();
        if (!this.isTransactional) {
            return;
        }
        const posting = await this.getPosting();
        if (posting === null) {
            return;
        }
        await posting.post();
    }
    async afterCancel() {
        await super.afterCancel();
        if (!this.isTransactional) {
            return;
        }
        const posting = await this.getPosting();
        if (posting === null) {
            return;
        }
        await posting.postReverse();
    }
    async afterDelete() {
        await super.afterDelete();
        if (!this.isTransactional) {
            return;
        }
        const ledgerEntryIds = (await this.fyo.db.getAll(ModelNameEnum.AccountingLedgerEntry, {
            fields: ['name'],
            filters: {
                referenceType: this.schemaName,
                referenceName: this.name,
            },
        }));
        for (const { name } of ledgerEntryIds) {
            const ledgerEntryDoc = await this.fyo.doc.getDoc(ModelNameEnum.AccountingLedgerEntry, name);
            await ledgerEntryDoc.delete();
        }
    }
}
//# sourceMappingURL=Transactional.js.map