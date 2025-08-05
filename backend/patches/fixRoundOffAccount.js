import { ModelNameEnum } from '../../models/types';
const FIELDNAME = 'roundOffAccount';
async function execute(dm) {
    const accounts = await dm.db.getSingleValues(FIELDNAME);
    if (!accounts.length) {
        await testAndSetRoundOffAccount(dm);
    }
    await dm.db.delete(ModelNameEnum.AccountingSettings, FIELDNAME);
    let isSet = false;
    for (const { parent, value } of accounts) {
        if (parent !== ModelNameEnum.AccountingSettings) {
            continue;
        }
        isSet = await setRoundOffAccountIfExists(value, dm);
        if (isSet) {
            break;
        }
    }
    if (!isSet) {
        await testAndSetRoundOffAccount(dm);
    }
}
async function testAndSetRoundOffAccount(dm) {
    const isSet = await setRoundOffAccountIfExists('Round Off', dm);
    if (!isSet) {
        await setRoundOffAccountIfExists('Rounded Off', dm);
    }
    return;
}
async function setRoundOffAccountIfExists(roundOffAccount, dm) {
    const exists = await dm.db.exists(ModelNameEnum.Account, roundOffAccount);
    if (!exists) {
        return false;
    }
    await dm.db.insert(ModelNameEnum.AccountingSettings, {
        roundOffAccount,
    });
    return true;
}
export default { execute, beforeMigrate: true };
//# sourceMappingURL=fixRoundOffAccount.js.map