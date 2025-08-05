export async function createIndianRecords(fyo) {
    await createTaxes(fyo);
}
async function createTaxes(fyo) {
    const GSTs = {
        GST: [28, 18, 12, 6, 5, 3, 0.25, 0],
        IGST: [28, 18, 12, 6, 5, 3, 0.25, 0],
        'Exempt-GST': [0],
        'Exempt-IGST': [0],
    };
    for (const type of Object.keys(GSTs)) {
        for (const percent of GSTs[type]) {
            const name = `${type}-${percent}`;
            const details = getTaxDetails(type, percent);
            const newTax = fyo.doc.getNewDoc('Tax', { name, details });
            await newTax.sync();
        }
    }
}
function getTaxDetails(type, percent) {
    if (type === 'GST') {
        return [
            {
                account: 'CGST',
                rate: percent / 2,
            },
            {
                account: 'SGST',
                rate: percent / 2,
            },
        ];
    }
    return [
        {
            account: type.toString().split('-')[0],
            rate: percent,
        },
    ];
}
//# sourceMappingURL=in.js.map