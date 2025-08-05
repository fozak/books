import { Doc } from 'fyo/model/doc';
import { ValidationError } from 'fyo/utils/errors';
import { t } from 'fyo';
import { ModelNameEnum } from 'models/types';
export class CouponCode extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            name: {
                formula: () => {
                    return this.couponName?.replace(/\s+/g, '').toUpperCase().slice(0, 8);
                },
                dependsOn: ['couponName'],
            },
        };
        this.validations = {
            minAmount: async (value) => {
                if (!value || !this.maxAmount || !this.pricingRule) {
                    return;
                }
                const [pricingRuleData] = await this.pricingRuleData();
                if (pricingRuleData?.minAmount.isZero() &&
                    pricingRuleData.maxAmount.isZero()) {
                    return;
                }
                const { minAmount } = pricingRuleData;
                if (value.isZero() && this.maxAmount.isZero()) {
                    return;
                }
                if (value.lt(minAmount)) {
                    throw new ValidationError(t `Minimum Amount should be greather than the Pricing Rule's Minimum Amount.`);
                }
                if (value.gte(this.maxAmount)) {
                    throw new ValidationError(t `Minimum Amount should be less than the Maximum Amount.`);
                }
            },
            maxAmount: async (value) => {
                if (!this.minAmount || !value || !this.pricingRule) {
                    return;
                }
                const [pricingRuleData] = await this.pricingRuleData();
                if (pricingRuleData?.minAmount.isZero() &&
                    pricingRuleData.maxAmount.isZero()) {
                    return;
                }
                const { maxAmount } = pricingRuleData;
                if (this.minAmount.isZero() && value.isZero()) {
                    return;
                }
                if (value.gt(maxAmount)) {
                    throw new ValidationError(t `Maximum Amount should be lesser than Pricing Rule's Maximum Amount`);
                }
                if (value.lte(this.minAmount)) {
                    throw new ValidationError(t `Maximum Amount should be greater than the Minimum Amount.`);
                }
            },
            validFrom: async (value) => {
                if (!value || !this.validTo || !this.pricingRule) {
                    return;
                }
                const [pricingRuleData] = await this.pricingRuleData();
                if (!pricingRuleData?.validFrom && !pricingRuleData.validTo) {
                    return;
                }
                const { validFrom } = pricingRuleData;
                if (validFrom &&
                    value.toISOString() < validFrom.toISOString()) {
                    throw new ValidationError(t `Valid From Date should be greather than Pricing Rule's Valid From Date.`);
                }
                if (value.toISOString() >= this.validTo.toISOString()) {
                    throw new ValidationError(t `Valid From Date should be less than Valid To Date.`);
                }
            },
            validTo: async (value) => {
                if (!this.validFrom || !value || !this.pricingRule) {
                    return;
                }
                const [pricingRuleData] = await this.pricingRuleData();
                if (!pricingRuleData?.validFrom && !pricingRuleData.validTo) {
                    return;
                }
                const { validTo } = pricingRuleData;
                if (validTo &&
                    value.toISOString() > validTo.toISOString()) {
                    throw new ValidationError(t `Valid To Date should be lesser than Pricing Rule's Valid To Date.`);
                }
                if (value.toISOString() <= this.validFrom.toISOString()) {
                    throw new ValidationError(t `Valid To Date should be greater than Valid From Date.`);
                }
            },
        };
    }
    removeUnusedCoupons(coupons, sinvDoc) {
        if (!coupons.length) {
            sinvDoc.coupons = [];
            return;
        }
        sinvDoc.coupons = sinvDoc.coupons.filter((coupon) => {
            return coupons.find((c) => coupon?.coupons?.includes(c?.coupon));
        });
    }
    async pricingRuleData() {
        return await this.fyo.db.getAll(ModelNameEnum.PricingRule, {
            fields: ['minAmount', 'maxAmount', 'validFrom', 'validTo'],
            filters: {
                name: this.pricingRule,
            },
        });
    }
    static getListViewSettings() {
        return {
            columns: ['name', 'couponName', 'pricingRule', 'maximumUse', 'used'],
        };
    }
}
CouponCode.filters = {
    pricingRule: () => ({
        isCouponCodeBased: true,
    }),
};
//# sourceMappingURL=CouponCode.js.map