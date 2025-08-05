import { Doc } from 'fyo/model/doc';
import { DEFAULT_CURRENCY } from 'fyo/utils/consts';
import { FieldTypeEnum } from 'schemas/types';
export class TaxSummary extends Doc {
    constructor(schema, data, fyo) {
        super(schema, data, fyo);
        this.getCurrencies = {};
        this._setGetCurrencies();
    }
    get exchangeRate() {
        return this.parentdoc?.exchangeRate ?? 1;
    }
    get currency() {
        return this.parentdoc?.currency ?? DEFAULT_CURRENCY;
    }
    _getCurrency() {
        if (this.exchangeRate === 1) {
            return this.fyo.singles.SystemSettings?.currency ?? DEFAULT_CURRENCY;
        }
        return this.currency;
    }
    _setGetCurrencies() {
        var _a;
        const currencyFields = this.schema.fields.filter(({ fieldtype }) => fieldtype === FieldTypeEnum.Currency);
        const getCurrency = this._getCurrency.bind(this);
        for (const { fieldname } of currencyFields) {
            (_a = this.getCurrencies)[fieldname] ?? (_a[fieldname] = getCurrency);
        }
    }
}
//# sourceMappingURL=TaxSummary.js.map