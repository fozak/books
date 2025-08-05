import { InvoiceItem } from '../InvoiceItem/InvoiceItem';
import { validateCouponCode } from 'models/helpers';
export class AppliedCouponCodes extends InvoiceItem {
    constructor() {
        super(...arguments);
        this.validations = {
            coupons: async (value) => {
                if (!value) {
                    return;
                }
                await validateCouponCode(this, value);
            },
        };
    }
}
//# sourceMappingURL=AppliedCouponCodes.js.map