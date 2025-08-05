import { getCOAList } from 'models/baseModels/SetupWizard/SetupWizard';
import { getStandardCOA } from './standardCOA';
const accountFields = ['accountType', 'accountNumber', 'rootType', 'isGroup'];
export class CreateCOA {
    constructor(chartOfAccounts, fyo) {
        this.chartOfAccounts = chartOfAccounts;
        this.fyo = fyo;
    }
    async run() {
        const chart = await getCOA(this.chartOfAccounts);
        await this.createCOAAccounts(chart, null, '', true);
    }
    async createCOAAccounts(children, parentAccount, rootType, rootAccount) {
        for (const rootName in children) {
            if (accountFields.includes(rootName)) {
                continue;
            }
            const child = children[rootName];
            if (rootAccount) {
                rootType = child.rootType;
            }
            const accountType = child.accountType ?? '';
            const accountNumber = child.accountNumber;
            const accountName = getAccountName(rootName, accountNumber);
            const isGroup = identifyIsGroup(child);
            const doc = this.fyo.doc.getNewDoc('Account', {
                name: accountName,
                parentAccount,
                isGroup,
                rootType,
                accountType,
            });
            await doc.sync();
            await this.createCOAAccounts(child, accountName, rootType, false);
        }
    }
}
function identifyIsGroup(child) {
    if (child.isGroup !== undefined) {
        return child.isGroup;
    }
    const keys = Object.keys(child);
    const children = keys.filter((key) => !accountFields.includes(key));
    if (children.length) {
        return true;
    }
    return false;
}
async function getCOA(chartOfAccounts) {
    const coaList = getCOAList();
    const coa = coaList.find(({ name }) => name === chartOfAccounts);
    const conCode = coa?.countryCode;
    if (!conCode) {
        return getStandardCOA();
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const countryCoa = (await import(`../../fixtures/verified/${conCode}.json`))
            .default;
        return countryCoa.tree;
    }
    catch (e) {
        return getStandardCOA();
    }
}
function getAccountName(accountName, accountNumber) {
    if (accountNumber) {
        return `${accountName} - ${accountNumber}`;
    }
    return accountName;
}
//# sourceMappingURL=createCOA.js.map