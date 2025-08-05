var _TranslationString_instances, _TranslationString_formatArg, _TranslationString_translate, _TranslationString_stitch;
import { __classPrivateFieldGet } from "tslib";
import { getIndexFormat, getIndexList, getSnippets, getWhitespaceSanitized, } from '../../utils/translationHelpers';
import { ValueError } from './errors';
export class TranslationString {
    constructor(...args) {
        _TranslationString_instances.add(this);
        this.args = args;
    }
    get s() {
        return this.toString();
    }
    ctx(context) {
        this.context = context;
        return this;
    }
    toString() {
        return __classPrivateFieldGet(this, _TranslationString_instances, "m", _TranslationString_stitch).call(this);
    }
    toJSON() {
        return __classPrivateFieldGet(this, _TranslationString_instances, "m", _TranslationString_stitch).call(this);
    }
    valueOf() {
        return __classPrivateFieldGet(this, _TranslationString_instances, "m", _TranslationString_stitch).call(this);
    }
}
_TranslationString_instances = new WeakSet(), _TranslationString_formatArg = function _TranslationString_formatArg(arg) {
    return String(arg ?? '');
}, _TranslationString_translate = function _TranslationString_translate() {
    let indexFormat = getIndexFormat(this.args[0]);
    indexFormat = getWhitespaceSanitized(indexFormat);
    const translatedIndexFormat = this.languageMap[indexFormat]?.translation ?? indexFormat;
    this.argList = getIndexList(translatedIndexFormat).map((i) => this.argList[i]);
    this.strList = getSnippets(translatedIndexFormat);
}, _TranslationString_stitch = function _TranslationString_stitch() {
    if (!(this.args[0] instanceof Array)) {
        throw new ValueError(`invalid args passed to TranslationString ${String(this.args)} of type ${typeof this.args[0]}`);
    }
    this.strList = this.args[0];
    this.argList = this.args.slice(1);
    if (this.languageMap) {
        __classPrivateFieldGet(this, _TranslationString_instances, "m", _TranslationString_translate).call(this);
    }
    return this.strList
        .map((s, i) => s + __classPrivateFieldGet(this, _TranslationString_instances, "m", _TranslationString_formatArg).call(this, this.argList[i]))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
};
export function T(...args) {
    return new TranslationString(...args);
}
export function t(...args) {
    return new TranslationString(...args).s;
}
export function setLanguageMapOnTranslationString(languageMap) {
    TranslationString.prototype.languageMap = languageMap;
}
export function translateSchema(map, languageMap, translateables) {
    if (Array.isArray(map)) {
        for (const item of map) {
            translateSchema(item, languageMap, translateables);
        }
        return;
    }
    if (typeof map !== 'object') {
        return;
    }
    for (const key of Object.keys(map)) {
        const value = map[key];
        if (typeof value === 'string' &&
            translateables.includes(key) &&
            languageMap[value]?.translation) {
            map[key] = languageMap[value].translation;
        }
        if (typeof value !== 'object') {
            continue;
        }
        translateSchema(value, languageMap, translateables);
    }
}
//# sourceMappingURL=translation.js.map