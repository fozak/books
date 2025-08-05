import { Doc } from 'fyo/model/doc';
export class LoyaltyPointEntry extends Doc {
    static getListViewSettings() {
        return {
            columns: [
                'loyaltyProgram',
                'customer',
                'purchaseAmount',
                'loyaltyPoints',
            ],
        };
    }
}
//# sourceMappingURL=LoyaltyPointEntry.js.map