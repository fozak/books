import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
export class PricingRuleItem extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            unit: {
                formula: () => {
                    if (!this.item) {
                        return;
                    }
                    return this.fyo.getValue(ModelNameEnum.Item, this.item, 'unit');
                },
            },
        };
    }
}
//# sourceMappingURL=PricingRuleItem.js.map