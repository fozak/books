import { Doc } from 'fyo/model/doc';
import { getSerialNumberStatusColumn } from 'models/helpers';
export class SerialNumber extends Doc {
    static getListViewSettings() {
        return {
            columns: [
                'name',
                getSerialNumberStatusColumn(),
                'item',
                'description',
                'party',
            ],
        };
    }
}
//# sourceMappingURL=SerialNumber.js.map