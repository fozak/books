import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
export class PriceListItem extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            unit: {
                formula: async () => {
                    if (!this.item) {
                        return;
                    }
                    return await this.fyo.getValue(ModelNameEnum.Item, this.item, 'unit');
                },
                dependsOn: ['item'],
            },
        };
    }
}
//# sourceMappingURL=PriceListItem.js.map