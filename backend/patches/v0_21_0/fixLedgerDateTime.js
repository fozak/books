/* eslint-disable */
async function execute(dm) {
    const sourceTables = [
        "PurchaseInvoice",
        "SalesInvoice",
        "JournalEntry",
        "Payment",
        "StockMovement",
        "StockTransfer"
    ];
    await dm.db.knex('AccountingLedgerEntry')
        .select('name', 'date', 'referenceName')
        .then((trx) => {
        trx.forEach(async (entry) => {
            sourceTables.forEach(async (table) => {
                await dm.db.knex
                    .select('name', 'date')
                    .from(table)
                    .where({ name: entry['referenceName'] })
                    .then(async (resp) => {
                    if (resp.length !== 0) {
                        const dateTimeValue = new Date(resp[0]['date']);
                        await dm.db.knex('AccountingLedgerEntry')
                            .where({ name: entry['name'] })
                            .update({ date: dateTimeValue.toISOString() });
                    }
                });
            });
        });
    });
}
export default { execute, beforeMigrate: true };
/* eslint-enable */ 
//# sourceMappingURL=fixLedgerDateTime.js.map