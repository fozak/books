import { Doc } from 'fyo/model/doc';
import { getLeadActions, getLeadStatusColumn } from 'models/helpers';
import { validateEmail, validatePhoneNumber, } from 'fyo/model/validationFunction';
import { ModelNameEnum } from 'models/types';
export class Lead extends Doc {
    constructor() {
        super(...arguments);
        this.validations = {
            email: validateEmail,
            mobile: validatePhoneNumber,
        };
    }
    createCustomer() {
        return this.fyo.doc.getNewDoc(ModelNameEnum.Party, {
            ...this.getValidDict(),
            fromLead: this.name,
            phone: this.mobile,
            role: 'Customer',
        });
    }
    createSalesQuote() {
        const data = {
            party: this.name,
            referenceType: ModelNameEnum.Lead,
        };
        return this.fyo.doc.getNewDoc(ModelNameEnum.SalesQuote, data);
    }
    static getActions(fyo) {
        return getLeadActions(fyo);
    }
    static getListViewSettings() {
        return {
            columns: ['name', getLeadStatusColumn(), 'email', 'mobile'],
        };
    }
}
//# sourceMappingURL=Lead.js.map