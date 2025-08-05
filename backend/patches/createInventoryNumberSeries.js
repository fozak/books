import { getDefaultMetaFieldValueMap } from '../../backend/helpers';
async function execute(dm) {
    const s = (await dm.db?.getAll('SingleValue', {
        fields: ['value'],
        filters: { fieldname: 'setupComplete' },
    }));
    if (!Number(s?.[0]?.value ?? '0')) {
        return;
    }
    const names = {
        StockMovement: 'SMOV-',
        PurchaseReceipt: 'PREC-',
        Shipment: 'SHPM-',
    };
    for (const referenceType in names) {
        const name = names[referenceType];
        await createNumberSeries(name, referenceType, dm);
    }
}
async function createNumberSeries(name, referenceType, dm) {
    const exists = await dm.db?.exists('NumberSeries', name);
    if (exists) {
        return;
    }
    await dm.db?.insert('NumberSeries', {
        name,
        start: 1001,
        padZeros: 4,
        current: 0,
        referenceType,
        ...getDefaultMetaFieldValueMap(),
    });
}
export default { execute, beforeMigrate: true };
//# sourceMappingURL=createInventoryNumberSeries.js.map