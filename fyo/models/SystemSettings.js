import { Doc } from 'fyo/model/doc';
import { ValidationError } from 'fyo/utils/errors';
import { t } from 'fyo/utils/translation';
import { getCountryInfo } from 'utils/misc';
class SystemSettings extends Doc {
    constructor() {
        super(...arguments);
        this.validations = {
            displayPrecision(value) {
                if (value >= 0 && value <= 9) {
                    return;
                }
                throw new ValidationError(t `Display Precision should have a value between 0 and 9.`);
            },
        };
    }
}
SystemSettings.lists = {
    locale() {
        const countryInfo = getCountryInfo();
        return Object.keys(countryInfo)
            .filter((c) => !!countryInfo[c]?.locale)
            .map((c) => ({
            value: countryInfo[c]?.locale,
            label: `${c} (${countryInfo[c]?.locale ?? t `Not Found`})`,
        }));
    },
    currency() {
        const countryInfo = getCountryInfo();
        const currencies = Object.values(countryInfo)
            .map((ci) => ci?.currency)
            .filter(Boolean);
        return [...new Set(currencies)];
    },
};
export default SystemSettings;
//# sourceMappingURL=SystemSettings.js.map