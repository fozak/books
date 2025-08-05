import { t } from 'fyo';
import { Doc } from 'fyo/model/doc';
import { validateEmail } from 'fyo/model/validationFunction';
import { DateTime } from 'luxon';
import { getCountryInfo, getFiscalYear } from 'utils/misc';
function getCurrencyList() {
    const result = [];
    const countryInfo = getCountryInfo();
    for (const info of Object.values(countryInfo)) {
        const { currency, code } = info ?? {};
        if (typeof currency !== 'string' || typeof code !== 'string') {
            continue;
        }
        result.push({ name: currency, countryCode: code });
    }
    return result;
}
export function getCOAList() {
    return [
        { name: t `Standard Chart of Accounts`, countryCode: '' },
        { countryCode: 'ae', name: 'U.A.E - Chart of Accounts' },
        {
            countryCode: 'ca',
            name: 'Canada - Plan comptable pour les provinces francophones',
        },
        { countryCode: 'gt', name: 'Guatemala - Cuentas' },
        { countryCode: 'hu', name: 'Hungary - Chart of Accounts' },
        { countryCode: 'id', name: 'Indonesia - Chart of Accounts' },
        { countryCode: 'in', name: 'India - Chart of Accounts' },
        { countryCode: 'mx', name: 'Mexico - Plan de Cuentas' },
        { countryCode: 'ni', name: 'Nicaragua - Catalogo de Cuentas' },
        { countryCode: 'nl', name: 'Netherlands - Grootboekschema' },
        { countryCode: 'sg', name: 'Singapore - Chart of Accounts' },
        { countryCode: 'fr', name: 'France - Plan Comptable General' },
        /*
        { countryCode: 'th', name: 'Thailand - Chart of Accounts' },
        { countryCode: 'us', name: 'United States - Chart of Accounts' },
        { countryCode: 've', name: 'Venezuela - Plan de Cuentas' },
        { countryCode: 'za', name: 'South Africa - Chart of Accounts' },
        { countryCode: 'de', name: 'Germany - Kontenplan' },
        { countryCode: 'it', name: 'Italy - Piano dei Conti' },
        { countryCode: 'es', name: 'Spain - Plan de Cuentas' },
        { countryCode: 'pt', name: 'Portugal - Plan de Contas' },
        { countryCode: 'pl', name: 'Poland - Rejestr Kont' },
        { countryCode: 'ro', name: 'Romania - Contabilitate' },
        { countryCode: 'ru', name: 'Russia - Chart of Accounts' },
        { countryCode: 'se', name: 'Sweden - Kontoplan' },
        { countryCode: 'ch', name: 'Switzerland - Kontenplan' },
        { countryCode: 'tr', name: 'Turkey - Chart of Accounts' },*/
    ];
}
export class SetupWizard extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            fiscalYearStart: {
                formula: (fieldname) => {
                    if (fieldname === 'fiscalYearEnd' &&
                        this.fiscalYearEnd &&
                        !this.fiscalYearStart) {
                        return DateTime.fromJSDate(this.fiscalYearEnd)
                            .minus({ years: 1 })
                            .plus({ days: 1 })
                            .toJSDate();
                    }
                    if (!this.country) {
                        return;
                    }
                    const countryInfo = getCountryInfo();
                    const fyStart = countryInfo[this.country]?.fiscal_year_start ?? '';
                    return getFiscalYear(fyStart, true);
                },
                dependsOn: ['country', 'fiscalYearEnd'],
            },
            fiscalYearEnd: {
                formula: (fieldname) => {
                    if (fieldname === 'fiscalYearStart' &&
                        this.fiscalYearStart &&
                        !this.fiscalYearEnd) {
                        return DateTime.fromJSDate(this.fiscalYearStart)
                            .plus({ years: 1 })
                            .minus({ days: 1 })
                            .toJSDate();
                    }
                    if (!this.country) {
                        return;
                    }
                    const countryInfo = getCountryInfo();
                    const fyEnd = countryInfo[this.country]?.fiscal_year_end ?? '';
                    return getFiscalYear(fyEnd, false);
                },
                dependsOn: ['country', 'fiscalYearStart'],
            },
            currency: {
                formula: () => {
                    const country = this.get('country');
                    if (typeof country !== 'string') {
                        return;
                    }
                    const countryInfo = getCountryInfo();
                    const { code } = countryInfo[country] ?? {};
                    if (!code) {
                        return;
                    }
                    const currencyList = getCurrencyList();
                    const currency = currencyList.find(({ countryCode }) => countryCode === code);
                    if (currency === undefined) {
                        return currencyList[0].name;
                    }
                    return currency.name;
                },
                dependsOn: ['country'],
            },
            chartOfAccounts: {
                formula: () => {
                    const country = this.get('country');
                    if (country === undefined) {
                        return;
                    }
                    const countryInfo = getCountryInfo();
                    const code = countryInfo[country]?.code;
                    if (!code) {
                        return;
                    }
                    const coaList = getCOAList();
                    const coa = coaList.find(({ countryCode }) => countryCode === code);
                    return coa?.name ?? coaList[0].name;
                },
                dependsOn: ['country'],
            },
        };
        this.validations = {
            email: validateEmail,
        };
    }
}
SetupWizard.lists = {
    country: () => Object.keys(getCountryInfo()),
    currency: () => getCurrencyList().map(({ name }) => name),
    chartOfAccounts: () => getCOAList().map(({ name }) => name),
};
//# sourceMappingURL=SetupWizard.js.map