import { Doc } from 'fyo/model/doc';
import { ValidationError } from 'fyo/utils/errors';
const invalidNumberSeries = /[/\=\?\&\%]/;
function getPaddedName(prefix, next, padZeros) {
    return prefix + next.toString().padStart(padZeros ?? 4, '0');
}
export default class NumberSeries extends Doc {
    constructor() {
        super(...arguments);
        this.validations = {
            name: (value) => {
                if (typeof value !== 'string') {
                    return;
                }
                if (invalidNumberSeries.test(value)) {
                    throw new ValidationError(this.fyo
                        .t `The following characters cannot be used ${'/, ?, &, =, %'} in a Number Series name.`);
                }
            },
        };
        this.readOnly = {
            referenceType: () => this.inserted,
            padZeros: () => this.inserted,
            start: () => this.inserted,
        };
    }
    setCurrent() {
        let current = this.get('current');
        /**
         * Increment current if it isn't the first entry. This
         * is to prevent reassignment of NumberSeries document ids.
         */
        if (!current) {
            current = this.get('start');
        }
        else {
            current = current + 1;
        }
        this.current = current;
    }
    async next(schemaName) {
        this.setCurrent();
        const exists = await this.checkIfCurrentExists(schemaName);
        if (exists) {
            this.current = this.current + 1;
        }
        await this.sync();
        return this.getPaddedName(this.current);
    }
    async checkIfCurrentExists(schemaName) {
        if (!schemaName) {
            return true;
        }
        const name = this.getPaddedName(this.current);
        return await this.fyo.db.exists(schemaName, name);
    }
    getPaddedName(next) {
        return getPaddedName(this.name, next, this.padZeros);
    }
}
//# sourceMappingURL=NumberSeries.js.map