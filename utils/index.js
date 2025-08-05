import { Money } from 'pesa';
/**
 * And so should not contain and platforma specific imports.
 */
export function getValueMapFromList(list, key, valueKey, filterUndefined = true) {
    if (filterUndefined) {
        list = list.filter((f) => f[valueKey] !== undefined &&
            f[key] !== undefined);
    }
    return list.reduce((acc, f) => {
        const keyValue = String(f[key]);
        const value = f[valueKey];
        acc[keyValue] = value;
        return acc;
    }, {});
}
export function getRandomString() {
    const randomNumber = Math.random().toString(36).slice(2, 8);
    const currentTime = Date.now().toString(36);
    return `${randomNumber}-${currentTime}`;
}
export async function sleep(durationMilliseconds = 1000) {
    return new Promise((r) => setTimeout(() => r(null), durationMilliseconds));
}
export function getMapFromList(list, name) {
    /**
     * Do not convert function to use copies of T
     * instead of references.
     */
    const acc = {};
    for (const t of list) {
        const key = t[name];
        if (key === undefined) {
            continue;
        }
        acc[String(key)] = t;
    }
    return acc;
}
export function getDefaultMapFromList(list, defaultValue, name) {
    const acc = {};
    if (typeof list[0] === 'string') {
        for (const l of list) {
            acc[l] = defaultValue;
        }
        return acc;
    }
    if (!name) {
        return {};
    }
    for (const l of list) {
        const key = String(l[name]);
        acc[key] = defaultValue;
    }
    return acc;
}
export function getListFromMap(map) {
    return Object.keys(map).map((n) => map[n]);
}
export function getIsNullOrUndef(value) {
    return value === null || value === undefined;
}
export function titleCase(phrase) {
    return phrase
        .split(' ')
        .map((word) => {
        const wordLower = word.toLowerCase();
        if (['and', 'an', 'a', 'from', 'by', 'on'].includes(wordLower)) {
            return wordLower;
        }
        return wordLower[0].toUpperCase() + wordLower.slice(1);
    })
        .join(' ');
}
export function invertMap(map) {
    const keys = Object.keys(map);
    const inverted = {};
    for (const key of keys) {
        const val = map[key];
        inverted[val] = key;
    }
    return inverted;
}
export function time(func, ...args) {
    /* eslint-disable no-console */
    const name = func.name;
    console.time(name);
    const stuff = func(...args);
    console.timeEnd(name);
    return stuff;
}
export async function timeAsync(func, ...args) {
    /* eslint-disable no-console */
    const name = func.name;
    console.time(name);
    const stuff = await func(...args);
    console.timeEnd(name);
    return stuff;
}
export function changeKeys(source, keyMap) {
    const dest = {};
    for (const key of Object.keys(source)) {
        const newKey = keyMap[key] ?? key;
        dest[newKey] = source[key];
    }
    return dest;
}
export function deleteKeys(source, keysToDelete) {
    const dest = {};
    for (const key of Object.keys(source)) {
        if (keysToDelete.includes(key)) {
            continue;
        }
        dest[key] = source[key];
    }
    return dest;
}
function safeParseNumber(value, parser) {
    let parsed;
    switch (typeof value) {
        case 'string':
            parsed = parser(value);
            break;
        case 'number':
            parsed = value;
            break;
        default:
            parsed = Number(value);
            break;
    }
    if (Number.isNaN(parsed)) {
        return 0;
    }
    return parsed;
}
export function safeParseFloat(value) {
    return safeParseNumber(value, Number);
}
export function safeParseInt(value) {
    return safeParseNumber(value, (v) => Math.trunc(Number(v)));
}
export function safeParsePesa(value, fyo) {
    if (value instanceof Money) {
        return value;
    }
    if (typeof value === 'number') {
        return fyo.pesa(value);
    }
    if (typeof value === 'bigint') {
        return fyo.pesa(value);
    }
    if (typeof value !== 'string') {
        return fyo.pesa(0);
    }
    try {
        return fyo.pesa(value);
    }
    catch {
        return fyo.pesa(0);
    }
}
export function joinMapLists(listA, listB, keyA, keyB) {
    const mapA = getMapFromList(listA, keyA);
    const mapB = getMapFromList(listB, keyB);
    const keyListA = listA
        .map((i) => i[keyA])
        .filter((k) => k in mapB);
    const keyListB = listB
        .map((i) => i[keyB])
        .filter((k) => k in mapA);
    const keys = new Set([keyListA, keyListB].flat().sort());
    const joint = [];
    for (const k of keys) {
        const a = mapA[k];
        const b = mapB[k];
        const c = { ...a, ...b };
        joint.push(c);
    }
    return joint;
}
export function removeAtIndex(array, index) {
    if (index < 0 || index >= array.length) {
        return array;
    }
    return [...array.slice(0, index), ...array.slice(index + 1)];
}
/**
 * Asserts that `value` is of type T. Use with care.
 */
export const assertIsType = (value) => true;
//# sourceMappingURL=index.js.map