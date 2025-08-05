import { Doc } from 'fyo/model/doc';
export class OpeningAmounts extends Doc {
    get openingCashAmount() {
        return this.parentdoc?.openingCashAmount;
    }
}
//# sourceMappingURL=OpeningAmounts.js.map