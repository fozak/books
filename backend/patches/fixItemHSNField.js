async function execute(dm) {
    const knexSchema = dm.db?.knex?.schema;
    await knexSchema?.alterTable('Item', (table) => {
        table.text('hsnCode').alter();
    });
}
export default { execute, beforeMigrate: true };
//# sourceMappingURL=fixItemHSNField.js.map