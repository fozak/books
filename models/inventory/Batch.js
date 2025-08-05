import { Doc } from 'fyo/model/doc';
export class Batch extends Doc {
    static getListViewSettings() {
        return {
            columns: ['name', 'expiryDate', 'manufactureDate'],
        };
    }
}
//# sourceMappingURL=Batch.js.map