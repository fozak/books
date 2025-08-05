import path from 'path';
import fs from 'fs-extra';
import { getInitializedPrintWindow } from './saveHtmlAsPdf';
export async function printHtmlDocument(html, app, width, height) {
    const tempRoot = app.getPath('temp');
    const tempFile = path.join(tempRoot, `temp-print.html`);
    await fs.writeFile(tempFile, html, { encoding: 'utf-8' });
    const printWindow = await getInitializedPrintWindow(tempFile, width, height);
    const success = await new Promise((resolve) => {
        printWindow.webContents.print({ silent: false, printBackground: true }, (success) => resolve(success));
    });
    printWindow.close();
    await fs.unlink(tempFile);
    return success;
}
//# sourceMappingURL=printHtmlDocument.js.map