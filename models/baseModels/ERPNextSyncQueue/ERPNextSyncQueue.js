import { Doc } from 'fyo/model/doc';
export class ERPNextSyncQueue extends Doc {
    constructor() {
        super(...arguments);
        this.hidden = {
            name: () => true,
        };
    }
    static getListViewSettings() {
        return {
            columns: ['referenceType', 'documentName'],
        };
    }
}
//# sourceMappingURL=ERPNextSyncQueue.js.map