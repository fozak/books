import { Doc } from 'fyo/model/doc';
export class POSClosingShift extends Doc {
    get closingCashAmount() {
        if (!this.closingCash) {
            return this.fyo.pesa(0);
        }
        let closingAmount = this.fyo.pesa(0);
        this.closingCash.map((row) => {
            const denomination = row.denomination ?? this.fyo.pesa(0);
            const count = row.count ?? 0;
            const amount = denomination.mul(count);
            closingAmount = closingAmount.add(amount);
        });
        return closingAmount;
    }
    static getListViewSettings() {
        return {
            columns: ['name', 'closingDate'],
        };
    }
}
//# sourceMappingURL=POSClosingShift.js.map