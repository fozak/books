import { Doc } from 'fyo/model/doc';
import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import { getMapFromList } from 'utils/index';
export class CustomForm extends Doc {
    constructor() {
        super(...arguments);
        this.hidden = { customFields: () => !this.name };
    }
    get parentSchema() {
        return this.fyo.schemaMap[this.name ?? ''] ?? null;
    }
    get parentFields() {
        const fields = this.parentSchema?.fields;
        if (!fields) {
            return {};
        }
        return getMapFromList(fields, 'fieldname');
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async validate() {
        for (const row of this.customFields ?? []) {
            if (row.fieldtype === 'Select' || row.fieldtype === 'AutoComplete') {
                this.validateOptions(row);
            }
        }
    }
    validateOptions(row) {
        const optionString = row.options ?? '';
        const options = optionString
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        if (options.length > 1) {
            return;
        }
        throw new ValidationError(`At least two options need to be set for the selected fieldtype`);
    }
}
CustomForm.lists = {
    name: (doc) => Object.values(doc?.fyo.schemaMap ?? {})
        .filter((s) => {
        if (!s || !s.label || !s.name) {
            return false;
        }
        if (s.isSingle) {
            return false;
        }
        return ![
            ModelNameEnum.PatchRun,
            ModelNameEnum.SingleValue,
            ModelNameEnum.CustomField,
            ModelNameEnum.CustomForm,
            ModelNameEnum.SetupWizard,
        ].includes(s.name);
    })
        .map((s) => ({
        value: s.name,
        label: s.label,
    })),
};
//# sourceMappingURL=CustomForm.js.map