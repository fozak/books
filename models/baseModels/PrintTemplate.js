import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
export class PrintTemplate extends Doc {
    constructor() {
        super(...arguments);
        this.readOnly = {
            name: () => !this.isCustom,
            type: () => !this.isCustom,
            template: () => !this.isCustom,
        };
    }
    get canDelete() {
        if (this.isCustom === false) {
            return false;
        }
        return super.canDelete;
    }
    static getListViewSettings(fyo) {
        return {
            formRoute: (name) => `/template-builder/${name}`,
            columns: [
                'name',
                {
                    label: fyo.t `Type`,
                    fieldtype: 'AutoComplete',
                    fieldname: 'type',
                    display(value) {
                        return fyo.schemaMap[value]?.label ?? '';
                    },
                },
                'isCustom',
            ],
        };
    }
    duplicate() {
        const doc = super.duplicate();
        doc.isCustom = true;
        return doc;
    }
}
PrintTemplate.lists = {
    type(doc) {
        let schemaMap = {};
        if (doc) {
            schemaMap = doc.fyo.schemaMap;
        }
        const models = [
            ModelNameEnum.SalesInvoice,
            ModelNameEnum.SalesQuote,
            ModelNameEnum.PurchaseInvoice,
            ModelNameEnum.JournalEntry,
            ModelNameEnum.Payment,
            ModelNameEnum.Shipment,
            ModelNameEnum.PurchaseReceipt,
            ModelNameEnum.StockMovement,
        ];
        return models.map((value) => ({
            value,
            label: schemaMap[value]?.label ?? value,
        }));
    },
};
//# sourceMappingURL=PrintTemplate.js.map