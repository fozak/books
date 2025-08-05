import { DEFAULT_SERIES_START } from 'fyo/utils/consts';
import { getRandomString } from 'utils';
export function isNameAutoSet(schemaName, fyo) {
    const schema = fyo.schemaMap[schemaName];
    if (schema.naming === 'manual') {
        return false;
    }
    if (schema.naming === 'autoincrement') {
        return true;
    }
    if (schema.naming === 'random') {
        return true;
    }
    const numberSeries = fyo.getField(schema.name, 'numberSeries');
    if (numberSeries) {
        return true;
    }
    return false;
}
export async function setName(doc, fyo) {
    if (doc.schema.naming === 'manual') {
        return;
    }
    if (doc.schema.naming === 'autoincrement') {
        return (doc.name = await getNextId(doc.schemaName, fyo));
    }
    if (doc.numberSeries !== undefined) {
        return (doc.name = await getSeriesNext(doc.numberSeries, doc.schemaName, fyo));
    }
    // name === schemaName for Single
    if (doc.schema.isSingle) {
        return (doc.name = doc.schemaName);
    }
    // Assign a random name by default
    if (!doc.name) {
        doc.name = getRandomString();
    }
    return doc.name;
}
export async function getNextId(schemaName, fyo) {
    const lastInserted = await fyo.db.getLastInserted(schemaName);
    return String(lastInserted + 1).padStart(9, '0');
}
export async function getSeriesNext(prefix, schemaName, fyo) {
    let series;
    try {
        series = (await fyo.doc.getDoc('NumberSeries', prefix));
    }
    catch (e) {
        const { statusCode } = e;
        if (!statusCode || statusCode !== 404) {
            throw e;
        }
        await createNumberSeries(prefix, schemaName, DEFAULT_SERIES_START, fyo);
        series = (await fyo.doc.getDoc('NumberSeries', prefix));
    }
    return await series.next(schemaName);
}
export async function createNumberSeries(prefix, referenceType, start, fyo) {
    const exists = await fyo.db.exists('NumberSeries', prefix);
    if (exists) {
        return;
    }
    const series = fyo.doc.getNewDoc('NumberSeries', {
        name: prefix,
        start,
        referenceType,
    });
    await series.sync();
}
//# sourceMappingURL=naming.js.map