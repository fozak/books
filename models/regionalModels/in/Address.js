import { Address as BaseAddress } from 'models/baseModels/Address/Address';
import { codeStateMap } from 'regional/in';
export class Address extends BaseAddress {
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
            pos: {
                formula: () => {
                    const stateList = Object.values(codeStateMap).sort();
                    const state = this.state;
                    if (stateList.includes(state)) {
                        return state;
                    }
                    return '';
                },
                dependsOn: ['state'],
            },
        };
    }
}
Address.lists = {
    ...BaseAddress.lists,
    pos: () => {
        return Object.values(codeStateMap).sort();
    },
};
//# sourceMappingURL=Address.js.map