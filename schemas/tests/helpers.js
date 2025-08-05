import { cloneDeep } from 'lodash';
import Account from '../app/Account.json';
import JournalEntry from '../app/JournalEntry.json';
import JournalEntryAccount from '../app/JournalEntryAccount.json';
import PartyRegional from '../regional/in/Party.json';
import Customer from './Customer.json';
import Party from './Party.json';
export function getTestSchemaMap() {
    const appSchemaMap = {
        Account,
        JournalEntry,
        JournalEntryAccount,
        Party,
        Customer,
    };
    const regionalSchemaMap = { Party: PartyRegional };
    return cloneDeep({
        appSchemaMap,
        regionalSchemaMap,
    });
}
export function everyFieldExists(fieldList, schema) {
    return fieldsExist(fieldList, schema, 'every');
}
export function someFieldExists(fieldList, schema) {
    return fieldsExist(fieldList, schema, 'some');
}
function fieldsExist(fieldList, schema, type) {
    const schemaFieldNames = schema.fields.map((f) => f.fieldname);
    return fieldList.map((f) => schemaFieldNames.includes(f))[type](Boolean);
}
export function subtract(targetList, ...removalLists) {
    const removalList = removalLists.flat();
    return targetList.filter((f) => !removalList.includes(f));
}
//# sourceMappingURL=helpers.js.map