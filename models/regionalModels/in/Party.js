import { Party as BaseParty } from 'models/baseModels/Party/Party';
export class Party extends BaseParty {
    constructor() {
        super(...arguments);
        this.hidden = {
            gstin: () => this.gstType !== 'Registered Regular',
            loyaltyProgram: () => {
                if (!this.fyo.singles.AccountingSettings?.enableLoyaltyProgram) {
                    return true;
                }
                return this.role === 'Supplier';
            },
            loyaltyPoints: () => !this.loyaltyProgram || this.role === 'Supplier',
        };
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async beforeSync() {
        const gstin = this.get('gstin');
        const gstType = this.get('gstType');
        if (gstin && gstType !== 'Registered Regular') {
            this.gstin = '';
        }
    }
}
//# sourceMappingURL=Party.js.map