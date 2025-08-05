import { Doc } from 'fyo/model/doc';
import { getIsDocEnabledColumn } from 'models/helpers';
import { ValidationError } from 'fyo/utils/errors';
import { t } from 'fyo';
export class PricingRule extends Doc {
    constructor() {
        super(...arguments);
        this.validations = {
            minQuantity: (value) => {
                if (!value || !this.maxQuantity) {
                    return;
                }
                if (value > this.maxQuantity) {
                    throw new ValidationError(t `Minimum Quantity should be less than the Maximum Quantity.`);
                }
            },
            maxQuantity: (value) => {
                if (!this.minQuantity || !value) {
                    return;
                }
                if (value < this.minQuantity) {
                    throw new ValidationError(t `Maximum Quantity should be greater than the Minimum Quantity.`);
                }
            },
            minAmount: (value) => {
                if (!value || !this.maxAmount) {
                    return;
                }
                if (value.isZero() || this.maxAmount.isZero()) {
                    return;
                }
                if (value.gte(this.maxAmount)) {
                    throw new ValidationError(t `Minimum Amount should be less than the Maximum Amount.`);
                }
            },
            maxAmount: (value) => {
                if (!this.minAmount || !value) {
                    return;
                }
                if (this.minAmount.isZero() || value.isZero()) {
                    return;
                }
                if (value.lte(this.minAmount)) {
                    throw new ValidationError(t `Maximum Amount should be greater than the Minimum Amount.`);
                }
            },
            validFrom: (value) => {
                if (!value || !this.validTo) {
                    return;
                }
                if (value.toISOString() > this.validTo.toISOString()) {
                    throw new ValidationError(t `Valid From Date should be less than Valid To Date.`);
                }
            },
            validTo: (value) => {
                if (!this.validFrom || !value) {
                    return;
                }
                if (value.toISOString() < this.validFrom.toISOString()) {
                    throw new ValidationError(t `Valid To Date should be greater than Valid From Date.`);
                }
            },
        };
        this.required = {
            priceDiscountType: () => this.isDiscountTypeIsPriceDiscount,
        };
        this.hidden = {
            location: () => !this.fyo.singles.AccountingSettings?.enableInventory,
            isCouponCodeBased: () => !this.fyo.singles.AccountingSettings?.enableCouponCode,
            priceDiscountType: () => !this.isDiscountTypeIsPriceDiscount,
            discountRate: () => !this.isDiscountTypeIsPriceDiscount || this.priceDiscountType !== 'rate',
            discountPercentage: () => !this.isDiscountTypeIsPriceDiscount ||
                this.priceDiscountType !== 'percentage',
            discountAmount: () => !this.isDiscountTypeIsPriceDiscount ||
                this.priceDiscountType !== 'amount',
            forPriceList: () => !this.isDiscountTypeIsPriceDiscount || this.priceDiscountType === 'rate',
            freeItem: () => this.isDiscountTypeIsPriceDiscount,
            freeItemQuantity: () => this.isDiscountTypeIsPriceDiscount,
            freeItemUnit: () => this.isDiscountTypeIsPriceDiscount,
            freeItemRate: () => this.isDiscountTypeIsPriceDiscount,
            roundFreeItemQty: () => this.isDiscountTypeIsPriceDiscount,
            roundingMethod: () => this.isDiscountTypeIsPriceDiscount || !this.roundFreeItemQty,
            isRecursive: () => this.isDiscountTypeIsPriceDiscount,
            recurseEvery: () => this.isDiscountTypeIsPriceDiscount || !this.isRecursive,
            recurseOver: () => this.isDiscountTypeIsPriceDiscount || !this.isRecursive,
        };
    }
    get isDiscountTypeIsPriceDiscount() {
        return this.discountType === 'Price Discount';
    }
    static getListViewSettings() {
        return {
            columns: ['name', 'title', getIsDocEnabledColumn(), 'discountType'],
        };
    }
}
//# sourceMappingURL=PricingRule.js.map