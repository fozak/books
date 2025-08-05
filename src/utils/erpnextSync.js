import { sendAPIRequest } from './api';
import { ModelNameEnum } from 'models/types';
import { getRandomString } from '../../utils';
import { ErrorLogEnum } from 'fyo/telemetry/types';
import { ValidationError } from 'fyo/utils/errors';
export async function registerInstanceToERPNext(fyo) {
    if (!navigator.onLine) {
        return;
    }
    const syncSettingsDoc = (await fyo.doc.getDoc(ModelNameEnum.ERPNextSyncSettings));
    const baseURL = syncSettingsDoc.baseURL;
    const token = syncSettingsDoc.authToken;
    let deviceID = syncSettingsDoc.deviceID;
    const instanceName = syncSettingsDoc.instanceName;
    if (!baseURL || !token) {
        return;
    }
    if (!deviceID) {
        await syncSettingsDoc.setAndSync('deviceID', getRandomString());
    }
    deviceID = syncSettingsDoc.deviceID;
    const registerInstance = fyo.singles.ERPNextSyncSettings
        ?.registerInstance;
    const response = (await sendAPIRequest(`${baseURL}/api/method/books_integration.api.${registerInstance}`, {
        method: 'POST',
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instance: deviceID,
            instance_name: instanceName,
        }),
    }));
    if (!response.message.success) {
        throw new ValidationError(response.message.message);
    }
}
export async function updateERPNSyncSettings(fyo) {
    if (!navigator.onLine) {
        return;
    }
    const syncSettingsDoc = (await fyo.doc.getDoc(ModelNameEnum.ERPNextSyncSettings));
    const baseURL = syncSettingsDoc.baseURL;
    const authToken = syncSettingsDoc.authToken;
    const deviceID = syncSettingsDoc.deviceID;
    if (!baseURL || !authToken || !deviceID) {
        return;
    }
    const res = await getERPNSyncSettings(fyo, baseURL, authToken);
    if (!res || !res.message || !res.message.success) {
        return;
    }
    await syncSettingsDoc.setMultiple(parseSyncSettingsData(res));
    await syncSettingsDoc.sync();
}
async function getERPNSyncSettings(fyo, baseURL, token) {
    const syncSettings = fyo.singles.ERPNextSyncSettings?.syncSettings;
    return (await sendAPIRequest(`${baseURL}/api/method/books_integration.api.${syncSettings}`, {
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json',
        },
    }));
}
export async function initERPNSync(fyo) {
    const isSyncEnabled = fyo.singles.ERPNextSyncSettings?.isEnabled;
    if (!isSyncEnabled) {
        return;
    }
    await syncDocumentsFromERPNext(fyo);
}
export async function syncDocumentsFromERPNext(fyo) {
    const isEnabled = fyo.singles.ERPNextSyncSettings?.isEnabled;
    if (!isEnabled) {
        return;
    }
    const token = fyo.singles.ERPNextSyncSettings?.authToken;
    const baseURL = fyo.singles.ERPNextSyncSettings?.baseURL;
    const deviceID = fyo.singles.ERPNextSyncSettings?.deviceID;
    if (!token || !baseURL) {
        return;
    }
    const docsToSync = await getDocsFromERPNext(fyo, baseURL, token, deviceID);
    if (!docsToSync?.message.success) {
        throw new ValidationError(docsToSync?.message.message);
    }
    if (!docsToSync || !docsToSync.message.success || !docsToSync.message.data) {
        return;
    }
    for (let doc of docsToSync.message.data.reverse()) {
        if (!isValidSyncableDocName(doc.doctype)) {
            continue;
        }
        if (!(getDocTypeName(doc) in ModelNameEnum)) {
            continue;
        }
        try {
            if (doc.fbooksDocName || doc.name) {
                const isDocExists = await fyo.db.exists(getDocTypeName(doc), doc.fbooksDocName || doc.name);
                if (isDocExists) {
                    const existingDoc = await fyo.doc.getDoc(getDocTypeName(doc), doc.fbooksDocName || doc.name);
                    doc.name = doc.fbooksDocName ?? doc.name;
                    doc = checkDocDataTypes(fyo, doc);
                    await existingDoc.setMultiple(doc);
                    await performPreSync(fyo, doc);
                    await appendDocValues(existingDoc, doc);
                    existingDoc._addDocToSyncQueue = false;
                    await existingDoc.sync();
                    if (doc.submitted) {
                        await existingDoc.submit();
                    }
                    if (doc.cancelled) {
                        await existingDoc.cancel();
                    }
                    await afterDocSync(fyo, baseURL, token, deviceID, doc, doc.erpnextDocName || doc.name, doc.name);
                    continue;
                }
            }
        }
        catch (error) {
            await fyo.doc
                .getNewDoc(ErrorLogEnum.IntegrationErrorLog, {
                error: error,
                data: JSON.stringify({ instance: deviceID, records: docsToSync }),
            })
                .sync();
        }
        try {
            const newDoc = fyo.doc.getNewDoc(getDocTypeName(doc), doc);
            await performPreSync(fyo, doc);
            await appendDocValues(newDoc, doc);
            newDoc._addDocToSyncQueue = false;
            await newDoc.sync();
            if (doc.submitted) {
                await newDoc.submit();
            }
            if (doc.cancelled) {
                await newDoc.cancel();
            }
            await afterDocSync(fyo, baseURL, token, deviceID, doc, doc.erpnextDocName || doc.name, newDoc.name);
        }
        catch (error) { }
    }
}
async function appendDocValues(newDoc, doc) {
    switch (doc.doctype) {
        case ModelNameEnum.Item:
            for (const uomDoc of doc.uomConversions) {
                await newDoc.append('uomConversions', {
                    uom: uomDoc.uom,
                    conversionFactor: uomDoc.conversionFactor,
                });
            }
        case ModelNameEnum.PricingRule:
            const itemSet = new Set();
            newDoc.appliedItems = newDoc.appliedItems?.filter((row) => {
                const key = `${row.item}::${row.unit}`;
                if (itemSet.has(key)) {
                    return false;
                }
                itemSet.add(key);
                return true;
            });
            const docItemSet = new Set(doc.appliedItems?.map((row) => `${row.item}::${row.unit}`) || []);
            newDoc.appliedItems = newDoc.appliedItems?.filter((row) => docItemSet.has(`${row.item}::${row.unit}`));
            break;
    }
}
async function performPreSync(fyo, doc) {
    switch (doc.doctype) {
        case ModelNameEnum.Item:
            const isUnitExists = await fyo.db.exists(ModelNameEnum.UOM, doc.unit);
            const isUnitExistsInQueue = (await fyo.db.getAll(ModelNameEnum.FetchFromERPNextQueue, {
                filters: {
                    referenceType: ModelNameEnum.UOM,
                    documentName: doc.unit,
                },
            })).length;
            if (!isUnitExists && !isUnitExistsInQueue) {
                await addToFetchFromERPNextQueue(fyo, {
                    referenceType: ModelNameEnum.UOM,
                    documentName: doc.unit,
                });
            }
            if (doc.uomConversions) {
                for (const row of doc.uomConversions) {
                    const isUnitExists = await fyo.db.exists(ModelNameEnum.UOM, row.uom);
                    if (!isUnitExists) {
                        const data = {
                            name: row.uom,
                            isWhole: row.isWhole,
                        };
                        await fyo.doc.getNewDoc(ModelNameEnum.UOM, data).sync();
                    }
                }
            }
            return;
        case 'Customer':
        case 'Supplier':
            const isAddressExists = await fyo.db.exists(ModelNameEnum.Address, doc.address);
            if (!isAddressExists) {
                await addToFetchFromERPNextQueue(fyo, {
                    referenceType: ModelNameEnum.Address,
                    documentName: doc.address,
                });
            }
            return;
        case ModelNameEnum.SalesInvoice:
            return await preSyncSalesInvoice(fyo, doc);
        case ModelNameEnum.StockMovement:
            if (!doc || !doc.items) {
                return;
            }
            for (const item of doc.items) {
                const isItemExists = await fyo.db.exists(ModelNameEnum.Item, item.item);
                if (!isItemExists) {
                    await addToFetchFromERPNextQueue(fyo, {
                        referenceType: ModelNameEnum.Item,
                        documentName: item.item,
                    });
                }
            }
            return;
        default:
            return;
    }
}
async function preSyncSalesInvoice(fyo, doc) {
    const isPartyExists = await fyo.db.exists(ModelNameEnum.Party, doc.party);
    if (!isPartyExists) {
        await addToFetchFromERPNextQueue(fyo, {
            referenceType: ModelNameEnum.Party,
            documentName: doc.party,
        });
    }
    if (doc.items) {
        for (const item of doc.items) {
            const isUnitExists = await fyo.db.exists(ModelNameEnum.UOM, item.unit);
            if (!isUnitExists) {
                await addToFetchFromERPNextQueue(fyo, {
                    referenceType: ModelNameEnum.UOM,
                    documentName: item.unit,
                });
            }
            const isItemExists = await fyo.db.exists(ModelNameEnum.Item, item.item);
            if (!isItemExists) {
                await addToFetchFromERPNextQueue(fyo, {
                    referenceType: ModelNameEnum.Item,
                    documentName: item.item,
                });
            }
            if (item.batch) {
                const isBatchExists = await fyo.db.exists(ModelNameEnum.Batch, item.batch);
                if (!isBatchExists) {
                    await addToFetchFromERPNextQueue(fyo, {
                        referenceType: ModelNameEnum.Batch,
                        documentName: item.batch,
                    });
                }
            }
        }
    }
    if (doc.priceList) {
        const isPriceListExists = await fyo.db.exists(ModelNameEnum.PriceList, doc.priceList);
        if (!isPriceListExists) {
            await addToFetchFromERPNextQueue(fyo, {
                referenceType: ModelNameEnum.PriceList,
                documentName: doc.priceList,
            });
        }
    }
}
async function addToFetchFromERPNextQueue(fyo, data) {
    await fyo.doc.getNewDoc(ModelNameEnum.FetchFromERPNextQueue, data).sync();
}
export async function syncDocumentsToERPNext(fyo) {
    const isEnabled = fyo.singles.ERPNextSyncSettings?.isEnabled;
    if (!isEnabled) {
        return;
    }
    const token = fyo.singles.ERPNextSyncSettings?.authToken;
    const baseURL = fyo.singles.ERPNextSyncSettings?.baseURL;
    const deviceID = fyo.singles.ERPNextSyncSettings?.deviceID;
    if (!token || !baseURL) {
        return;
    }
    const docsToSync = [];
    const syncQueueItems = (await fyo.db.getAll(ModelNameEnum.ERPNextSyncQueue, {
        fields: ['name', 'referenceType', 'documentName'],
        order: 'desc',
    }));
    if (!syncQueueItems.length) {
        return;
    }
    for (const doc of syncQueueItems) {
        const referenceDoc = await fyo.doc.getDoc(doc.referenceType, doc.documentName);
        if (!referenceDoc) {
            continue;
        }
        docsToSync.push({
            doctype: getDocTypeName(referenceDoc),
            ...referenceDoc.getValidDict(),
        });
    }
    if (!docsToSync.length) {
        return;
    }
    try {
        const syncDataToERPNext = fyo.singles.ERPNextSyncSettings?.syncDataToERPNext;
        const res = (await sendAPIRequest(`${baseURL}/api/method/books_integration.api.${syncDataToERPNext}`, {
            method: 'POST',
            headers: {
                Authorization: `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ instance: deviceID, records: docsToSync }),
        }));
        if (!res.message.success) {
            return await fyo.doc
                .getNewDoc(ErrorLogEnum.IntegrationErrorLog, {
                error: JSON.stringify(res),
                data: JSON.stringify({ instance: deviceID, records: docsToSync }),
            })
                .sync();
        }
        for (const doc of syncQueueItems) {
            const syncQueueDoc = await fyo.doc.getDoc(ModelNameEnum.ERPNextSyncQueue, doc.name);
            await syncQueueDoc.delete();
        }
    }
    catch (error) {
        return await fyo.doc
            .getNewDoc(ErrorLogEnum.IntegrationErrorLog, {
            error: error,
            data: JSON.stringify({ instance: deviceID, records: docsToSync }),
        })
            .sync();
    }
}
async function getDocsFromERPNext(fyo, baseURL, token, deviceID) {
    const fetchFromERPNextQueue = fyo.singles.ERPNextSyncSettings?.fetchFromERPNextQueue;
    return (await sendAPIRequest(`${baseURL}/api/method/books_integration.api.${fetchFromERPNextQueue}?instance=${deviceID}`, {
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json',
        },
    }));
}
async function afterDocSync(fyo, baseURL, token, deviceID, doc, erpnDocName, fbooksDocName) {
    const data = {
        doctype: getDocTypeName(doc),
        nameInERPNext: erpnDocName,
        nameInFBooks: fbooksDocName,
        doc,
    };
    const clearSyncedDocsFromErpNextSyncQueue = fyo.singles.ERPNextSyncSettings
        ?.clearSyncedDocsFromErpNextSyncQueue;
    return await ipc.sendAPIRequest(`${baseURL}/api/method/books_integration.api.${clearSyncedDocsFromErpNextSyncQueue}`, {
        method: 'POST',
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instance: deviceID,
            data,
        }),
    });
}
export function getShouldDocSyncToERPNext(doc) {
    const syncableModels = [
        ModelNameEnum.SalesInvoice,
        ModelNameEnum.Payment,
        ModelNameEnum.Shipment,
        ModelNameEnum.POSOpeningShift,
        ModelNameEnum.POSClosingShift,
    ];
    if (syncableModels.includes(doc.schemaName)) {
        return true;
    }
    return false;
}
function changeDocDataType(fyo, doc, fields, type) {
    const updatedDoc = { ...doc };
    for (const field of fields) {
        if (field in updatedDoc) {
            switch (type) {
                case ModelNameEnum.Currency:
                    updatedDoc[field] = fyo.pesa(updatedDoc[field]);
                    break;
                default:
                    break;
            }
        }
    }
    return updatedDoc;
}
function checkDocDataTypes(fyo, doc) {
    switch (doc.doctype) {
        case ModelNameEnum.Item: {
            const fields = ['rate'];
            const updatedDoc = changeDocDataType(fyo, doc, fields, ModelNameEnum.Currency);
            return updatedDoc;
        }
        case ModelNameEnum.PricingRule: {
            const fields = [
                'minAmount',
                'maxAmount',
                'discountAmount',
                'discountRate',
                'freeItemRate',
            ];
            const updatedDoc = changeDocDataType(fyo, doc, fields, ModelNameEnum.Currency);
            return updatedDoc;
        }
        default:
            return doc;
    }
}
function isValidSyncableDocName(doctype) {
    const syncableDocNames = [
        ModelNameEnum.Item,
        ModelNameEnum.ItemGroup,
        ModelNameEnum.Batch,
        ModelNameEnum.PricingRule,
    ];
    if (syncableDocNames.includes(doctype)) {
        return true;
    }
    return false;
}
function getDocTypeName(doc) {
    const doctype = doc.schemaName ?? doc.referenceType ?? doc.doctype;
    if (['Supplier', 'Customer'].includes(doctype)) {
        return ModelNameEnum.Party;
    }
    if (doctype === 'Party') {
        if (doc.role && doc.role !== 'Both') {
            return doc.role;
        }
    }
    return doctype;
}
function parseSyncSettingsData(res) {
    return {
        integrationAppVersion: res.message.app_version,
        isEnabled: !!res.message.data.enable_sync,
    };
}
//# sourceMappingURL=erpnextSync.js.map