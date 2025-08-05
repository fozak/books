export class Version {
    /**
     * comparators for version strings of the form
     * x.x.x[-beta.x]
     */
    static gte(a, b) {
        let valid = false;
        return compare(a, b, (c) => {
            if (c === 0) {
                return false;
            }
            valid || (valid = c > 0);
            return !valid;
        });
    }
    static lte(a, b) {
        return !Version.gt(a, b);
    }
    static eq(a, b) {
        return compare(a, b, (c) => c !== 0);
    }
    static gt(a, b) {
        return Version.gte(a, b) && !Version.eq(a, b);
    }
    static lt(a, b) {
        return Version.lte(a, b) && !Version.eq(a, b);
    }
}
const seq = ['major', 'minor', 'patch', 'beta'];
function compare(a, b, isInvalid) {
    const partsA = parseVersionString(a);
    const partsB = parseVersionString(b);
    for (const p of seq) {
        const c = compareSingle(partsA, partsB, p);
        if (isInvalid(c)) {
            return false;
        }
    }
    return true;
}
function parseVersionString(a) {
    const parts = a.split('-');
    const nonbeta = parts[0].split('.').map((n) => parseFloat(n));
    const versionParts = {
        major: nonbeta[0],
        minor: nonbeta[1],
        patch: nonbeta[2],
    };
    const beta = parseFloat(parts[1]?.split('.')?.[1]);
    if (!Number.isNaN(beta)) {
        versionParts.beta = beta;
    }
    if (Number.isNaN(beta) && parts[1]?.includes('beta')) {
        versionParts.beta = 0;
    }
    return versionParts;
}
function compareSingle(partsA, partsB, key) {
    if (key !== 'beta') {
        return partsA[key] - partsB[key];
    }
    if (typeof partsA.beta === 'number' && typeof partsB.beta === 'number') {
        return partsA.beta - partsB.beta;
    }
    // A is not in beta
    if (partsA.beta === undefined && typeof partsB.beta === 'number') {
        return 1;
    }
    // B is not in beta
    if (typeof partsA.beta === 'number' && partsB.beta === undefined) {
        return -1;
    }
    // Both A and B are not in Beta
    return 0;
}
//# sourceMappingURL=version.js.map