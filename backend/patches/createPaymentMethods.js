import { ModelNameEnum } from 'models/types';
import { AccountTypeEnum } from 'models/baseModels/Account/types';
import { getDefaultMetaFieldValueMap } from 'backend/helpers';
async function execute(dm) {
    const accounts = (await dm.db?.getAll(ModelNameEnum.Account, {
        fields: ['name', 'accountType'],
        filters: {
            accountType: [
                'in',
                [
                    AccountTypeEnum.Bank,
                    AccountTypeEnum.Cash,
                    AccountTypeEnum.Payable,
                    AccountTypeEnum.Receivable,
                ],
            ],
        },
    }));
    const accountsMap = accounts.reduce((acc, ac) => {
        var _a;
        acc[_a = ac.accountType] ?? (acc[_a] = []);
        acc[ac.accountType].push(ac.name);
        return acc;
    }, {});
    const defaults = getDefaultMetaFieldValueMap();
    const paymentMethods = [
        {
            name: 'Cash',
            type: 'Cash',
            account: accountsMap[AccountTypeEnum.Cash]?.[0],
            ...defaults,
        },
        {
            name: 'Bank',
            type: 'Bank',
            account: accountsMap[AccountTypeEnum.Bank]?.[0],
            ...defaults,
        },
        {
            name: 'Transfer',
            type: 'Bank',
            account: accountsMap[AccountTypeEnum.Bank]?.[0],
            ...defaults,
        },
    ];
    for (const paymentMethod of paymentMethods) {
        await dm.db?.insert(ModelNameEnum.PaymentMethod, paymentMethod);
    }
}
export default { execute };
//# sourceMappingURL=createPaymentMethods.js.map