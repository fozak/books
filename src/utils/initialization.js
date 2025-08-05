import { getRegionalModels, models } from 'models/index';
import { ModelNameEnum } from 'models/types';
import { getMapFromList, getRandomString, getValueMapFromList, } from 'utils/index';
export async function initializeInstance(dbPath, isNew, countryCode, fyo) {
    if (isNew) {
        await closeDbIfConnected(fyo);
        countryCode = await fyo.db.createNewDatabase(dbPath, countryCode);
    }
    else if (!fyo.db.isConnected) {
        countryCode = await fyo.db.connectToDatabase(dbPath);
    }
    const regionalModels = await getRegionalModels(countryCode);
    await fyo.initializeAndRegister(models, regionalModels);
    await checkSingleLinks(fyo);
    await setSingles(fyo);
    await setCreds(fyo);
    await setVersion(fyo);
    setDeviceId(fyo);
    await setInstanceId(fyo);
    await setOpenCount(fyo);
    await setCurrencySymbols(fyo);
}
async function closeDbIfConnected(fyo) {
    if (!fyo.db.isConnected) {
        return;
    }
    await fyo.db.purgeCache();
}
async function setSingles(fyo) {
    for (const schema of Object.values(fyo.schemaMap)) {
        if (!schema?.isSingle || schema.name === ModelNameEnum.SetupWizard) {
            continue;
        }
        await fyo.doc.getDoc(schema.name);
    }
}
async function checkSingleLinks(fyo) {
    /**
     * Required cause SingleValue tables don't maintain
     * referential integrity. Hence values Linked in the
     * Singles table can be deleted.
     *
     * These deleted links can prevent the db from loading.
     */
    const linkFields = Object.values(fyo.db.schemaMap)
        .filter((schema) => schema?.isSingle)
        .map((schema) => schema.fields)
        .flat()
        .filter((field) => field.fieldtype === 'Link' && field.target)
        .map((field) => ({
        fieldKey: `${field.schemaName}.${field.fieldname}`,
        target: field.target,
    }));
    const linkFieldsMap = getMapFromList(linkFields, 'fieldKey');
    const singleValues = (await fyo.db.getAllRaw('SingleValue', {
        fields: ['name', 'parent', 'fieldname', 'value'],
    }));
    const exists = {};
    for (const { name, fieldname, parent, value } of singleValues) {
        const fieldKey = `${parent}.${fieldname}`;
        if (!linkFieldsMap[fieldKey]) {
            continue;
        }
        const { target } = linkFieldsMap[fieldKey];
        if (typeof value !== 'string' || !value || !target) {
            continue;
        }
        exists[target] ?? (exists[target] = {});
        if (exists[target][value] === undefined) {
            exists[target][value] = await fyo.db.exists(target, value);
        }
        if (exists[target][value]) {
            continue;
        }
        await fyo.db.delete('SingleValue', name);
    }
}
async function setCreds(fyo) {
    const email = (await fyo.getValue(ModelNameEnum.AccountingSettings, 'email'));
    const user = fyo.auth.user;
    fyo.auth.user = email ?? user;
}
async function setVersion(fyo) {
    const version = (await fyo.getValue(ModelNameEnum.SystemSettings, 'version'));
    const { appVersion } = fyo.store;
    if (version !== appVersion) {
        const systemSettings = await fyo.doc.getDoc(ModelNameEnum.SystemSettings);
        await systemSettings?.setAndSync('version', appVersion);
    }
}
function setDeviceId(fyo) {
    let deviceId = fyo.config.get('deviceId');
    if (deviceId === undefined) {
        deviceId = getRandomString();
        fyo.config.set('deviceId', deviceId);
    }
    fyo.store.deviceId = deviceId;
}
async function setInstanceId(fyo) {
    const systemSettings = await fyo.doc.getDoc(ModelNameEnum.SystemSettings);
    if (!systemSettings.instanceId) {
        await systemSettings.setAndSync('instanceId', getRandomString());
    }
    fyo.store.instanceId = (await fyo.getValue(ModelNameEnum.SystemSettings, 'instanceId'));
}
export async function setCurrencySymbols(fyo) {
    const currencies = (await fyo.db.getAll(ModelNameEnum.Currency, {
        fields: ['name', 'symbol'],
    }));
    fyo.currencySymbols = getValueMapFromList(currencies, 'name', 'symbol');
}
async function setOpenCount(fyo) {
    const misc = await fyo.doc.getDoc(ModelNameEnum.Misc);
    let openCount = misc.openCount;
    if (typeof openCount !== 'number') {
        openCount = getOpenCountFromFiles(fyo);
    }
    if (typeof openCount !== 'number') {
        openCount = 0;
    }
    openCount += 1;
    await misc.setAndSync('openCount', openCount);
}
function getOpenCountFromFiles(fyo) {
    const configFile = fyo.config.get('files', []);
    for (const file of configFile) {
        if (file.id === fyo.singles.SystemSettings?.instanceId) {
            return file.openCount ?? 0;
        }
    }
    return null;
}
//# sourceMappingURL=initialization.js.map