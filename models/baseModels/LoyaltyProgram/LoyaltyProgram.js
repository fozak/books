import { Doc } from 'fyo/model/doc';
import { AccountRootTypeEnum } from '../Account/types';
export class LoyaltyProgram extends Doc {
    static getListViewSettings() {
        return {
            columns: ['name', 'fromDate', 'toDate', 'expiryDuration'],
        };
    }
}
LoyaltyProgram.filters = {
    expenseAccount: () => ({
        rootType: AccountRootTypeEnum.Expense,
        isGroup: false,
    }),
};
//# sourceMappingURL=LoyaltyProgram.js.map