import { Doc } from 'fyo/model/doc';
import { getIsDocEnabledColumn, getPriceListStatusColumn, } from 'models/helpers';
export class PriceList extends Doc {
    static getListViewSettings() {
        return {
            columns: ['name', getIsDocEnabledColumn(), getPriceListStatusColumn()],
        };
    }
}
//# sourceMappingURL=PriceList.js.map