import { ModelNameEnum } from 'models/types';
import { getQuoteActions, getTransactionStatusColumn } from '../../helpers';
import { Invoice } from '../Invoice/Invoice';
export class SalesQuote extends Invoice {
    // This is an inherited method and it must keep the async from the parent
    // class
    // eslint-disable-next-line @typescript-eslint/require-await
    async getPosting() {
        return null;
    }
    async getInvoice() {
        if (!this.isSubmitted) {
            return null;
        }
        const schemaName = ModelNameEnum.SalesInvoice;
        const defaults = this.fyo.singles.Defaults ?? {};
        const terms = defaults.salesInvoiceTerms ?? '';
        const numberSeries = defaults.salesInvoiceNumberSeries ?? undefined;
        const data = {
            ...this.getValidDict(false, true),
            date: new Date().toISOString(),
            terms,
            numberSeries,
            quote: this.name,
            items: [],
            submitted: false,
        };
        const invoice = this.fyo.doc.getNewDoc(schemaName, data);
        for (const row of this.items ?? []) {
            await invoice.append('items', row.getValidDict(false, true));
        }
        if (!invoice.items?.length) {
            return null;
        }
        return invoice;
    }
    async afterSubmit() {
        await super.afterSubmit();
        if (this.referenceType == ModelNameEnum.Lead) {
            const partyDoc = (await this.loadAndGetLink('party'));
            await partyDoc.setAndSync('status', 'Quotation');
        }
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
        return getQuoteActions(fyo, ModelNameEnum.SalesQuote);
    }
}
SalesQuote.filters = {
    numberSeries: (doc) => ({ referenceType: doc.schemaName }),
};
//# sourceMappingURL=SalesQuote.js.map