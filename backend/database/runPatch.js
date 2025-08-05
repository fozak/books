import { emitMainProcessError, getDefaultMetaFieldValueMap } from '../helpers';
export async function runPatches(patches, dm, version) {
    const list = [];
    for (const patch of patches) {
        const success = await runPatch(patch, dm, version);
        list.push({ name: patch.name, success });
    }
    return list;
}
async function runPatch(patch, dm, version) {
    let failed = false;
    try {
        await patch.patch.execute(dm);
    }
    catch (error) {
        failed = true;
        if (error instanceof Error) {
            error.message = `Patch Failed: ${patch.name}\n${error.message}`;
            emitMainProcessError(error, { patchName: patch.name, notifyUser: false });
        }
    }
    await makeEntry(patch.name, version, failed, dm);
    return true;
}
async function makeEntry(patchName, version, failed, dm) {
    const defaultFieldValueMap = getDefaultMetaFieldValueMap();
    defaultFieldValueMap.name = patchName;
    defaultFieldValueMap.failed = failed;
    defaultFieldValueMap.version = version;
    try {
        await dm.db.insert('PatchRun', defaultFieldValueMap);
    }
    catch {
        /**
         * Error is thrown if PatchRun table hasn't been migrated.
         * In this case, PatchRun will migrated post pre-migration-patches
         * are run and rerun the patch.
         */
        return;
    }
}
//# sourceMappingURL=runPatch.js.map