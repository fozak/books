import { Doc } from 'fyo/model/doc';
export class ItemGroup extends Doc {
    static getListViewSettings() {
        return {
            columns: ['name', 'tax', 'hsnCode'],
        };
    }
}
//# sourceMappingURL=ItemGroup.js.map