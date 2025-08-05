import fs from 'fs/promises';
import path from 'path';
export async function getTemplates(posTemplateWidth) {
    const paths = await getPrintTemplatePaths();
    if (!paths) {
        return [];
    }
    const templates = [];
    for (const file of paths.files) {
        const filePath = path.join(paths.root, file);
        const template = await fs.readFile(filePath, 'utf-8');
        const { mtime } = await fs.stat(filePath);
        const width = file?.split('-')[1]?.split('.')[0] === 'POS' ? posTemplateWidth ?? 0 : 0;
        const height = file?.split('-')[1]?.split('.')[0] === 'POS' ? 22 : 0;
        templates.push({
            template,
            file,
            modified: mtime.toISOString(),
            width,
            height,
        });
    }
    return templates;
}
async function getPrintTemplatePaths() {
    let root = path.join(process.resourcesPath, `../templates`);
    try {
        const files = await fs.readdir(root);
        return { files, root };
    }
    catch {
        root = path.join(__dirname, '..', '..', `templates`);
    }
    try {
        const files = await fs.readdir(root);
        return { files, root };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=getPrintTemplates.js.map