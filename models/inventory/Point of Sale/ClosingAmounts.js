import { Doc } from 'fyo/model/doc';
export class ClosingAmounts extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            differenceAmount: {
                formula: () => {
                    if (!this.closingAmount) {
                        return this.fyo.pesa(0);
                    }
                    if (!this.expectedAmount) {
                        return this.fyo.pesa(0);
                    }
                    return this.closingAmount.sub(this.expectedAmount);
                },
            },
        };
    }
}
//# sourceMappingURL=ClosingAmounts.js.map