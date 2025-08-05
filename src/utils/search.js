import { t } from 'fyo';
import { groupBy } from 'lodash';
import { ModelNameEnum } from 'models/types';
import { reports } from 'reports';
import { createFilters, routeFilters } from 'src/utils/filters';
import { safeParseFloat } from 'utils/index';
import { fuzzyMatch } from '.';
import { getFormRoute, routeTo } from './ui';
export const searchGroups = [
    'Docs',
    'List',
    'Create',
    'Report',
    'Page',
];
export function getGroupLabelMap() {
    return {
        Create: t `Create`,
        List: t `List`,
        Report: t `Report`,
        Docs: t `Docs`,
        Page: t `Page`,
    };
}
function getCreateAction(fyo, schemaName, initData) {
    return async function action() {
        const doc = fyo.doc.getNewDoc(schemaName, initData);
        const route = getFormRoute(schemaName, doc.name);
        await routeTo(route);
    };
}
function getCreateList(fyo) {
    const hasInventory = fyo.doc.singles.AccountingSettings?.enableInventory;
    const formEditCreateList = [
        ModelNameEnum.SalesInvoice,
        ModelNameEnum.PurchaseInvoice,
        ModelNameEnum.JournalEntry,
        ...(hasInventory
            ? [
                ModelNameEnum.Shipment,
                ModelNameEnum.PurchaseReceipt,
                ModelNameEnum.StockMovement,
            ]
            : []),
    ].map((schemaName) => ({
        label: fyo.schemaMap[schemaName]?.label,
        group: 'Create',
        action: getCreateAction(fyo, schemaName),
    }));
    const filteredCreateList = [
        {
            label: t `Sales Payment`,
            schemaName: ModelNameEnum.Payment,
            create: createFilters.SalesPayments,
        },
        {
            label: t `Purchase Payment`,
            schemaName: ModelNameEnum.Payment,
            create: createFilters.PurchasePayments,
        },
        {
            label: t `Customer`,
            schemaName: ModelNameEnum.Party,
            create: createFilters.Customers,
        },
        {
            label: t `Supplier`,
            schemaName: ModelNameEnum.Party,
            create: createFilters.Suppliers,
        },
        {
            label: t `Party`,
            schemaName: ModelNameEnum.Party,
            create: createFilters.Party,
        },
        {
            label: t `Sales Item`,
            schemaName: ModelNameEnum.Item,
            create: createFilters.SalesItems,
        },
        {
            label: t `Purchase Item`,
            schemaName: ModelNameEnum.Item,
            create: createFilters.PurchaseItems,
        },
        {
            label: t `Item`,
            schemaName: ModelNameEnum.Item,
            create: createFilters.Items,
        },
    ].map(({ label, create, schemaName }) => {
        return {
            label,
            group: 'Create',
            action: getCreateAction(fyo, schemaName, create),
        };
    });
    return [formEditCreateList, filteredCreateList].flat();
}
function getReportList(fyo) {
    const hasGstin = !!fyo.singles?.AccountingSettings?.gstin;
    const hasInventory = !!fyo.singles?.AccountingSettings?.enableInventory;
    const reportNames = Object.keys(reports);
    return reportNames
        .filter((r) => {
        const report = reports[r];
        if (report.isInventory && !hasInventory) {
            return false;
        }
        if (report.title.startsWith('GST') && !hasGstin) {
            return false;
        }
        return true;
    })
        .map((r) => {
        const report = reports[r];
        return {
            label: report.title,
            route: `/report/${r}`,
            group: 'Report',
        };
    });
}
function getListViewList(fyo) {
    let schemaNames = [
        ModelNameEnum.Account,
        ModelNameEnum.JournalEntry,
        ModelNameEnum.PurchaseInvoice,
        ModelNameEnum.SalesInvoice,
        ModelNameEnum.Tax,
        ModelNameEnum.UOM,
        ModelNameEnum.Address,
        ModelNameEnum.AccountingLedgerEntry,
        ModelNameEnum.Currency,
        ModelNameEnum.NumberSeries,
        ModelNameEnum.PrintTemplate,
    ];
    if (fyo.doc.singles.AccountingSecuttings?.enableInventory) {
        schemaNames.push(ModelNameEnum.StockMovement, ModelNameEnum.Shipment, ModelNameEnum.PurchaseReceipt, ModelNameEnum.Location, ModelNameEnum.StockLedgerEntry);
    }
    if (fyo.doc.singles.AccountingSettings?.enablePriceList) {
        schemaNames.push(ModelNameEnum.PriceList);
    }
    if (fyo.singles.InventorySettings?.enableBatches) {
        schemaNames.push(ModelNameEnum.Batch);
    }
    if (fyo.singles.InventorySettings?.enableSerialNumber) {
        schemaNames.push(ModelNameEnum.SerialNumber);
    }
    if (fyo.doc.singles.AccountingSettings?.enableFormCustomization) {
        schemaNames.push(ModelNameEnum.CustomForm);
    }
    schemaNames = Object.keys(fyo.schemaMap);
    const standardLists = schemaNames
        .map((s) => fyo.schemaMap[s])
        .filter((s) => s && !s.isChild && !s.isSingle)
        .map((s) => ({
        label: s.label,
        route: `/list/${s.name}`,
        group: 'List',
    }));
    const filteredLists = [
        {
            label: t `Customers`,
            route: `/list/Party/${t `Customers`}`,
            filters: routeFilters.Customers,
        },
        {
            label: t `Suppliers`,
            route: `/list/Party/${t `Suppliers`}`,
            filters: routeFilters.Suppliers,
        },
        {
            label: t `Party`,
            route: `/list/Party/${t `Party`}`,
            filters: routeFilters.Party,
        },
        {
            label: t `Sales Items`,
            route: `/list/Item/${t `Sales Items`}`,
            filters: routeFilters.SalesItems,
        },
        {
            label: t `Sales Payments`,
            route: `/list/Payment/${t `Sales Payments`}`,
            filters: routeFilters.SalesPayments,
        },
        {
            label: t `Purchase Items`,
            route: `/list/Item/${t `Purchase Items`}`,
            filters: routeFilters.PurchaseItems,
        },
        {
            label: t `Items`,
            route: `/list/Item/${t `Items`}`,
            filters: routeFilters.Items,
        },
        {
            label: t `Purchase Payments`,
            route: `/list/Payment/${t `Purchase Payments`}`,
            filters: routeFilters.PurchasePayments,
        },
    ].map((i) => {
        const label = i.label;
        const route = encodeURI(`${i.route}?filters=${JSON.stringify(i.filters)}`);
        return { label, route, group: 'List' };
    });
    return [standardLists, filteredLists].flat();
}
function getSetupList() {
    return [
        {
            label: t `Dashboard`,
            route: '/',
            group: 'Page',
        },
        {
            label: t `Chart of Accounts`,
            route: '/chart-of-accounts',
            group: 'Page',
        },
        {
            label: t `Import Wizard`,
            route: '/import-wizard',
            group: 'Page',
        },
        {
            label: t `Settings`,
            route: '/settings',
            group: 'Page',
        },
    ];
}
function getNonDocSearchList(fyo) {
    return [
        getListViewList(fyo),
        getCreateList(fyo),
        getReportList(fyo),
        getSetupList(),
    ]
        .flat()
        .map((d) => {
        if (d.route && !d.action) {
            d.action = async () => {
                await routeTo(d.route);
            };
        }
        return d;
    });
}
export class Search {
    constructor(fyo) {
        /**
         * A simple fuzzy searcher.
         *
         * How the Search works:
         * - Pulls `keywordFields` (string columns) from the db.
         * - `name` or `parent` (parent doc's name) is used as the main
         *   label.
         * - The `name`, `keywordFields` and schema label are used as
         *   search target terms.
         * - Input is split on `' '` (whitespace) and each part has to completely
         *   or partially match the search target terms.
         * - Non matches are ignored.
         * - Each letter in the input narrows the search using the `this._intermediate`
         *   object where the incremental searches are stored.
         * - Search index is marked for updation when a doc is entered or deleted.
         * - Marked indices are rebuilt when the modal is opened.
         */
        this._obsSet = false;
        this.numSearches = 0;
        this.priorityMap = {
            [ModelNameEnum.SalesInvoice]: 125,
            [ModelNameEnum.PurchaseInvoice]: 100,
            [ModelNameEnum.Payment]: 75,
            [ModelNameEnum.StockMovement]: 75,
            [ModelNameEnum.Shipment]: 75,
            [ModelNameEnum.PurchaseReceipt]: 75,
            [ModelNameEnum.Item]: 50,
            [ModelNameEnum.Party]: 50,
            [ModelNameEnum.JournalEntry]: 50,
        };
        this.filters = {
            groupFilters: {
                List: true,
                Report: true,
                Create: true,
                Page: true,
                Docs: true,
            },
            schemaFilters: {},
            skipTables: false,
            skipTransactions: false,
        };
        this._intermediate = { suggestions: [] };
        this.fyo = fyo;
        this.keywords = {};
        this.searchables = {};
        this._nonDocSearchList = getNonDocSearchList(fyo);
    }
    /**
     * these getters are used for hacky two way binding between the
     * `skipT*` filters and the `schemaFilters`.
     */
    get skipTables() {
        let value = true;
        for (const val of Object.values(this.searchables)) {
            if (!val.isChild) {
                continue;
            }
            value && (value = !this.filters.schemaFilters[val.schemaName]);
        }
        return value;
    }
    get skipTransactions() {
        let value = true;
        for (const val of Object.values(this.searchables)) {
            if (!val.isSubmittable) {
                continue;
            }
            value && (value = !this.filters.schemaFilters[val.schemaName]);
        }
        return value;
    }
    set(filterName, value) {
        /**
         * When a filter is set, intermediate is reset
         * this way the groups are rebuild with the filters
         * applied.
         */
        if (filterName in this.filters.groupFilters) {
            this.filters.groupFilters[filterName] = value;
        }
        else if (filterName in this.searchables) {
            this.filters.schemaFilters[filterName] = value;
            this.filters.skipTables = this.skipTables;
            this.filters.skipTransactions = this.skipTransactions;
        }
        else if (filterName === 'skipTables') {
            Object.values(this.searchables)
                .filter(({ isChild }) => isChild)
                .forEach(({ schemaName }) => {
                this.filters.schemaFilters[schemaName] = !value;
            });
            this.filters.skipTables = value;
        }
        else if (filterName === 'skipTransactions') {
            Object.values(this.searchables)
                .filter(({ isSubmittable }) => isSubmittable)
                .forEach(({ schemaName }) => {
                this.filters.schemaFilters[schemaName] = !value;
            });
            this.filters.skipTransactions = value;
        }
        this._setIntermediate([]);
    }
    async initializeKeywords() {
        this._setSearchables();
        await this.updateKeywords();
        this._setDocObservers();
        this._setSchemaFilters();
        this._groupLabelMap = getGroupLabelMap();
        this._setFilterDefaults();
    }
    _setFilterDefaults() {
        const totalChildKeywords = Object.values(this.searchables)
            .filter((s) => s.isChild)
            .map((s) => this.keywords[s.schemaName]?.length ?? 0)
            .reduce((a, b) => a + b, 0);
        if (totalChildKeywords > 2000) {
            this.set('skipTables', true);
        }
    }
    _setSchemaFilters() {
        for (const name in this.searchables) {
            this.filters.schemaFilters[name] = true;
        }
    }
    async updateKeywords() {
        for (const searchable of Object.values(this.searchables)) {
            if (!searchable.needsUpdate) {
                continue;
            }
            const options = {
                fields: [searchable.fields, searchable.meta].flat(),
                order: 'desc',
            };
            if (!searchable.isChild) {
                options.orderBy = 'modified';
            }
            const maps = await this.fyo.db.getAllRaw(searchable.schemaName, options);
            this._setKeywords(maps, searchable);
            this.searchables[searchable.schemaName].needsUpdate = false;
        }
    }
    _searchSuggestions(input) {
        const matches = [];
        for (const si of this._intermediate.suggestions) {
            const label = si.label;
            const groupLabel = si.schemaLabel || this._groupLabelMap?.[si.group];
            const more = si.more ?? [];
            const values = [label, more, groupLabel]
                .flat()
                .filter(Boolean);
            const { isMatch, distance } = this._getMatchAndDistance(input, values);
            if (isMatch) {
                matches.push({ si, distance });
            }
        }
        matches.sort((a, b) => a.distance - b.distance);
        const suggestions = matches.map((m) => m.si);
        this._setIntermediate(suggestions, input);
        return suggestions;
    }
    _shouldUseSuggestions(input) {
        if (!input) {
            return false;
        }
        const { suggestions, previousInput } = this._intermediate;
        if (!suggestions?.length || !previousInput) {
            return false;
        }
        if (!input.startsWith(previousInput)) {
            return false;
        }
        return true;
    }
    _setIntermediate(suggestions, previousInput) {
        this.numSearches = suggestions.length;
        this._intermediate.suggestions = suggestions;
        this._intermediate.previousInput = previousInput;
    }
    search(input) {
        const useSuggestions = this._shouldUseSuggestions(input);
        /**
         * If the suggestion list is already populated
         * and the input is an extention of the previous
         * then use the suggestions.
         */
        if (useSuggestions) {
            return this._searchSuggestions(input);
        }
        else {
            this._setIntermediate([]);
        }
        /**
         * Create the suggestion list.
         */
        const groupedKeywords = this._getGroupedKeywords();
        const keys = Object.keys(groupedKeywords);
        if (!keys.includes('0')) {
            keys.push('0');
        }
        keys.sort((a, b) => safeParseFloat(b) - safeParseFloat(a));
        const array = [];
        for (const key of keys) {
            const keywords = groupedKeywords[key] ?? [];
            this._pushDocSearchItems(keywords, array, input);
            if (key === '0') {
                this._pushNonDocSearchItems(array, input);
            }
        }
        this._setIntermediate(array, input);
        return array;
    }
    _pushDocSearchItems(keywords, array, input) {
        if (!input) {
            return;
        }
        if (!this.filters.groupFilters.Docs) {
            return;
        }
        const subArray = this._getSubSortedArray(keywords, input);
        array.push(...subArray);
    }
    _pushNonDocSearchItems(array, input) {
        const filtered = this._nonDocSearchList.filter((si) => this.filters.groupFilters[si.group]);
        const subArray = this._getSubSortedArray(filtered, input);
        array.push(...subArray);
    }
    _getSubSortedArray(items, input) {
        const subArray = [];
        for (const item of items) {
            const subArrayItem = this._getSubArrayItem(item, input);
            if (!subArrayItem) {
                continue;
            }
            subArray.push(subArrayItem);
        }
        subArray.sort((a, b) => a.distance - b.distance);
        return subArray.map(({ item }) => item);
    }
    _getSubArrayItem(item, input) {
        if (isSearchItem(item)) {
            return this._getSubArrayItemFromSearchItem(item, input);
        }
        if (!input) {
            return null;
        }
        return this._getSubArrayItemFromKeyword(item, input);
    }
    _getSubArrayItemFromSearchItem(item, input) {
        if (!input) {
            return { item, distance: 0 };
        }
        const values = this._getValueListFromSearchItem(item).filter(Boolean);
        const { isMatch, distance } = this._getMatchAndDistance(input, values);
        if (!isMatch) {
            return null;
        }
        return { item, distance };
    }
    _getValueListFromSearchItem({ label, group }) {
        return [label, group];
    }
    _getSubArrayItemFromKeyword(item, input) {
        const values = this._getValueListFromKeyword(item).filter(Boolean);
        const { isMatch, distance } = this._getMatchAndDistance(input, values);
        if (!isMatch) {
            return null;
        }
        return {
            item: this._getDocSearchItemFromKeyword(item),
            distance,
        };
    }
    _getValueListFromKeyword({ values, meta }) {
        const schemaLabel = meta.schemaName;
        return [values, schemaLabel].flat();
    }
    _getMatchAndDistance(input, values) {
        /**
         * All the parts should match with something.
         */
        let distance = Number.MAX_SAFE_INTEGER;
        for (const part of input.split(' ').filter(Boolean)) {
            const match = this._getInternalMatch(part, values);
            if (!match.isMatch) {
                return { isMatch: false, distance: Number.MAX_SAFE_INTEGER };
            }
            distance = match.distance < distance ? match.distance : distance;
        }
        return { isMatch: true, distance };
    }
    _getInternalMatch(input, values) {
        let isMatch = false;
        let distance = Number.MAX_SAFE_INTEGER;
        for (const k of values) {
            const match = fuzzyMatch(input, k);
            isMatch || (isMatch = match.isMatch);
            if (match.distance < distance) {
                distance = match.distance;
            }
        }
        return { isMatch, distance };
    }
    _getDocSearchItemFromKeyword(keyword) {
        const schemaName = keyword.meta.schemaName;
        const schemaLabel = this.fyo.schemaMap[schemaName]?.label ?? schemaName;
        const route = this._getRouteFromKeyword(keyword);
        return {
            label: keyword.values[0],
            schemaLabel,
            more: keyword.values.slice(1),
            group: 'Docs',
            action: async () => {
                await routeTo(route);
            },
        };
    }
    _getRouteFromKeyword(keyword) {
        const { parent, parentSchemaName, schemaName } = keyword.meta;
        if (parent && parentSchemaName) {
            return getFormRoute(parentSchemaName, parent);
        }
        return getFormRoute(schemaName, keyword.values[0]);
    }
    _getGroupedKeywords() {
        /**
         * filter out the ignored groups
         * group by the keyword priority
         */
        const keywords = [];
        const schemaNames = Object.keys(this.keywords);
        for (const sn of schemaNames) {
            const searchable = this.searchables[sn];
            if (!this.filters.schemaFilters[sn] || !this.filters.groupFilters.Docs) {
                continue;
            }
            if (searchable.isChild && this.filters.skipTables) {
                continue;
            }
            if (searchable.isSubmittable && this.filters.skipTransactions) {
                continue;
            }
            keywords.push(...this.keywords[sn]);
        }
        return groupBy(keywords.flat(), 'priority');
    }
    _setSearchables() {
        for (const schemaName of Object.keys(this.fyo.schemaMap)) {
            const schema = this.fyo.schemaMap[schemaName];
            if (!schema?.keywordFields?.length || this.searchables[schemaName]) {
                continue;
            }
            const fields = [...schema.keywordFields];
            const meta = [];
            if (schema.isChild) {
                meta.push('parent', 'parentSchemaName');
            }
            if (schema.isSubmittable) {
                meta.push('submitted', 'cancelled');
            }
            this.searchables[schemaName] = {
                schemaName,
                fields,
                meta,
                isChild: !!schema.isChild,
                isSubmittable: !!schema.isSubmittable,
                needsUpdate: true,
            };
        }
    }
    _setDocObservers() {
        if (this._obsSet) {
            return;
        }
        for (const { schemaName } of Object.values(this.searchables)) {
            this.fyo.doc.observer.on(`sync:${schemaName}`, () => {
                this.searchables[schemaName].needsUpdate = true;
            });
            this.fyo.doc.observer.on(`delete:${schemaName}`, () => {
                this.searchables[schemaName].needsUpdate = true;
            });
        }
        this._obsSet = true;
    }
    _setKeywords(maps, searchable) {
        if (!maps?.length) {
            return;
        }
        this.keywords[searchable.schemaName] = [];
        for (const map of maps) {
            const keyword = { values: [], meta: {}, priority: 0 };
            this._setKeywordValues(map, searchable, keyword);
            this._setMeta(map, searchable, keyword);
            this.keywords[searchable.schemaName].push(keyword);
        }
        this._setPriority(searchable);
    }
    _setKeywordValues(map, searchable, keyword) {
        // Set individual field values
        for (const fn of searchable.fields) {
            let value = map[fn];
            const field = this.fyo.getField(searchable.schemaName, fn);
            const { options } = field;
            if (options) {
                value = options.find((o) => o.value === value)?.label ?? value;
            }
            keyword.values.push(value ?? '');
        }
    }
    _setMeta(map, searchable, keyword) {
        // Set the meta map
        for (const fn of searchable.meta) {
            const meta = map[fn];
            if (typeof meta === 'number') {
                keyword.meta[fn] = Boolean(meta);
            }
            else if (typeof meta === 'string') {
                keyword.meta[fn] = meta;
            }
        }
        keyword.meta.schemaName = searchable.schemaName;
        if (keyword.meta.parent) {
            keyword.values.unshift(keyword.meta.parent);
        }
    }
    _setPriority(searchable) {
        const keywords = this.keywords[searchable.schemaName] ?? [];
        const basePriority = this.priorityMap[searchable.schemaName] ?? 0;
        for (const k of keywords) {
            k.priority += basePriority;
            if (k.meta.submitted) {
                k.priority += 25;
            }
            if (k.meta.cancelled) {
                k.priority -= 200;
            }
            if (searchable.isChild) {
                k.priority -= 150;
            }
        }
    }
}
function isSearchItem(item) {
    return !!item.group;
}
//# sourceMappingURL=search.js.map