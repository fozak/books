import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
import { AccountRootTypeEnum } from './types';
export class Account extends Doc {
    constructor() {
        super(...arguments);
        this.required = {
            /**
             * Added here cause rootAccounts don't have parents
             * they are created during initialization. if this is
             * added to the schema it will cause NOT NULL errors
             */
            parentAccount: () => !!this.fyo.singles?.AccountingSettings?.setupComplete,
        };
        this.formulas = {
            rootType: {
                formula: async () => {
                    if (!this.parentAccount) {
                        return;
                    }
                    return await this.fyo.getValue(ModelNameEnum.Account, this.parentAccount, 'rootType');
                },
            },
        };
        this.readOnly = {
            rootType: () => this.inserted,
            parentAccount: () => this.inserted,
            accountType: () => !!this.accountType && this.inserted,
            isGroup: () => this.inserted,
        };
    }
    get isDebit() {
        if (this.rootType === AccountRootTypeEnum.Asset) {
            return true;
        }
        if (this.rootType === AccountRootTypeEnum.Expense) {
            return true;
        }
        return false;
    }
    get isCredit() {
        return !this.isDebit;
    }
    async beforeSync() {
        if (this.accountType || !this.parentAccount) {
            return;
        }
        const account = await this.fyo.db.get('Account', this.parentAccount);
        this.accountType = account.accountType;
    }
    static getListViewSettings() {
        return {
            columns: ['name', 'rootType', 'isGroup', 'parentAccount'],
        };
    }
    static getTreeSettings(fyo) {
        return {
            parentField: 'parentAccount',
            async getRootLabel() {
                const accountingSettings = await fyo.doc.getDoc('AccountingSettings');
                return accountingSettings.companyName;
            },
        };
    }
}
Account.defaults = {
    /**
     * NestedSet indices are actually not used
     * this needs updation as they may be required
     * later on.
     */
    lft: () => 0,
    rgt: () => 0,
};
Account.filters = {
    parentAccount: (doc) => {
        const filter = {
            isGroup: true,
        };
        if (doc?.rootType) {
            filter.rootType = doc.rootType;
        }
        return filter;
    },
};
//# sourceMappingURL=Account.js.map