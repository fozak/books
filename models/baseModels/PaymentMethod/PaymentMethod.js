import { Doc } from 'fyo/model/doc';
export class PaymentMethod extends Doc {
    static getListViewSettings() {
        return {
            columns: ['name', 'type'],
        };
    }
}
//# sourceMappingURL=PaymentMethod.js.map