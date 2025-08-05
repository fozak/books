import { t } from 'fyo';
import { getDocStatus, getLedgerLinkAction, getNumberSeries, getStatusText, statusColor, } from 'models/helpers';
import { Transactional } from 'models/Transactional/Transactional';
import { LedgerPosting } from '../../Transactional/LedgerPosting';
export class JournalEntry extends Transactional {
    constructor() {
        super(...arguments);
        this.hidden = {
            referenceNumber: () => !(this.referenceNumber || !(this.isSubmitted || this.isCancelled)),
            referenceDate: () => !(this.referenceDate || !(this.isSubmitted || this.isCancelled)),
            userRemark: () => !(this.userRemark || !(this.isSubmitted || this.isCancelled)),
            attachment: () => !(this.attachment || !(this.isSubmitted || this.isCancelled)),
        };
    }
    async getPosting() {
        const posting = new LedgerPosting(this, this.fyo);
        for (const row of this.accounts ?? []) {
            const debit = row.debit;
            const credit = row.credit;
            const account = row.account;
            if (!debit.isZero()) {
                await posting.debit(account, debit);
            }
            else if (!credit.isZero()) {
                await posting.credit(account, credit);
            }
        }
        return posting;
    }
    static getActions(fyo) {
        return [getLedgerLinkAction(fyo)];
    }
    static getListViewSettings() {
        return {
            columns: [
                'name',
                {
                    label: t `Status`,
                    fieldname: 'status',
                    fieldtype: 'Select',
                    render(doc) {
                        const status = getDocStatus(doc);
                        const color = statusColor[status] ?? 'gray';
                        const label = getStatusText(status);
                        return {
                            template: `<Badge class="text-xs" color="${color}">${label}</Badge>`,
                        };
                    },
                },
                'date',
                'entryType',
                'referenceNumber',
            ],
        };
    }
}
JournalEntry.defaults = {
    numberSeries: (doc) => getNumberSeries(doc.schemaName, doc.fyo),
    date: () => new Date(),
};
JournalEntry.filters = {
    numberSeries: () => ({ referenceType: 'JournalEntry' }),
};
//# sourceMappingURL=JournalEntry.js.map