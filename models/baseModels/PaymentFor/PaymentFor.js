import { t } from 'fyo';
import { Doc } from 'fyo/model/doc';
import { NotFoundError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import { PartyRoleEnum } from '../Party/types';
export class PaymentFor extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            referenceType: {
                formula: async () => {
                    if (this.referenceType) {
                        return;
                    }
                    const party = await this.parentdoc?.loadAndGetLink('party');
                    if (!party) {
                        return ModelNameEnum.SalesInvoice;
                    }
                    if (party.role === PartyRoleEnum.Supplier) {
                        return ModelNameEnum.PurchaseInvoice;
                    }
                    return ModelNameEnum.SalesInvoice;
                },
            },
            referenceName: {
                formula: async () => {
                    if (!this.referenceName || !this.referenceType) {
                        return this.referenceName;
                    }
                    const exists = await this.fyo.db.exists(this.referenceType, this.referenceName);
                    if (!exists) {
                        return null;
                    }
                    return this.referenceName;
                },
                dependsOn: ['referenceType'],
            },
            amount: {
                formula: async () => {
                    if (!this.referenceName) {
                        return this.fyo.pesa(0);
                    }
                    const outstandingAmount = (await this.fyo.getValue(this.referenceType, this.referenceName, 'outstandingAmount'));
                    if (outstandingAmount) {
                        return outstandingAmount;
                    }
                    return this.fyo.pesa(0);
                },
                dependsOn: ['referenceName'],
            },
        };
        this.validations = {
            referenceName: async (value) => {
                const exists = await this.fyo.db.exists(this.referenceType, value);
                if (exists) {
                    return;
                }
                const referenceType = this.referenceType ?? ModelNameEnum.SalesInvoice;
                const label = this.fyo.schemaMap[referenceType]?.label ?? referenceType;
                throw new NotFoundError(t `${label} ${value} does not exist`, false);
            },
        };
    }
}
PaymentFor.filters = {
    referenceName: (doc) => {
        const zero = '0.' +
            '0'.repeat(doc.fyo.singles.SystemSettings?.internalPrecision ?? 11);
        const baseFilters = {
            outstandingAmount: ['!=', zero],
            submitted: true,
            cancelled: false,
        };
        const party = doc?.parentdoc?.party;
        if (!party) {
            return baseFilters;
        }
        return { ...baseFilters, party };
    },
};
//# sourceMappingURL=PaymentFor.js.map