import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
export class POSProfile extends Doc {
}
POSProfile.filters = {
    posPrintTemplate: () => ({ type: ModelNameEnum.SalesInvoice }),
};
//# sourceMappingURL=PosProfile.js.map