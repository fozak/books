import { Doc } from 'fyo/model/doc';
export class ItemEnquiry extends Doc {
    static getListViewSettings() {
        return {
            columns: ['item', 'customer', 'contact', 'description', 'similarProduct'],
        };
    }
}
//# sourceMappingURL=ItemEnquiry.js.map