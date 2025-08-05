import { t } from 'fyo';
import { Doc } from 'fyo/model/doc';
import { codeStateMap } from 'regional/in';
import { getCountryInfo } from 'utils/misc';
export class Address extends Doc {
    constructor() {
        super(...arguments);
        this.formulas = {
            addressDisplay: {
                formula: () => {
                    return [
                        this.addressLine1,
                        this.addressLine2,
                        this.city,
                        this.state,
                        this.country,
                        this.postalCode,
                    ]
                        .filter(Boolean)
                        .join(', ');
                },
                dependsOn: [
                    'addressLine1',
                    'addressLine2',
                    'city',
                    'state',
                    'country',
                    'postalCode',
                ],
            },
        };
    }
    static getListViewSettings() {
        return {
            columns: ['name', 'addressLine1', 'city', 'state', 'country'],
        };
    }
}
Address.lists = {
    state(doc) {
        const country = doc?.country;
        switch (country) {
            case 'India':
                return Object.values(codeStateMap).sort();
            default:
                return [];
        }
    },
    country() {
        return Object.keys(getCountryInfo()).sort();
    },
};
Address.emptyMessages = {
    state: (doc) => {
        if (doc.country) {
            return t `Enter State`;
        }
        return t `Enter Country to load States`;
    },
};
//# sourceMappingURL=Address.js.map