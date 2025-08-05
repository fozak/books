import { Doc } from 'fyo/model/doc';
export class FetchFromERPNextQueue extends Doc {
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
//# sourceMappingURL=FetchFromERPNextQueue.js.map