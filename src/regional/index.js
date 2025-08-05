import { createIndianRecords } from './in/in';
export async function createRegionalRecords(country, fyo) {
    if (country === 'India') {
        await createIndianRecords(fyo);
    }
    return;
}
//# sourceMappingURL=index.js.map