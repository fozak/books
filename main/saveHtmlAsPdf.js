import { BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
export async function saveHtmlAsPdf(html, savePath, app, width, // centimeters
height // centimeters
) {
    /**
     * Store received html as a file in a tempdir,
     * this will be loaded into the print view
     */
    const tempRoot = app.getPath('temp');
    const filename = path.parse(savePath).name;
    const htmlPath = path.join(tempRoot, `${filename}.html`);
    await fs.writeFile(htmlPath, html, { encoding: 'utf-8' });
    const printWindow = await getInitializedPrintWindow(htmlPath, width, height);
    const printOptions = {
        margins: { top: 0, bottom: 0, left: 0, right: 0 }, // equivalent to previous 'marginType: 1'
        pageSize: {
            height: height / 2.54, // Convert from centimeters to inches
            width: width / 2.54, // Convert from centimeters to inches
        },
        printBackground: true,
    };
    const data = await printWindow.webContents.printToPDF(printOptions);
    await fs.writeFile(savePath, data);
    printWindow.close();
    await fs.unlink(htmlPath);
    return true;
}
export async function getInitializedPrintWindow(printFilePath, width, height) {
    const printWindow = new BrowserWindow({
        width: Math.floor(width * 28.333333), // pixels
        height: Math.floor(height * 28.333333), // pixels
        show: false,
    });
    await printWindow.loadFile(printFilePath);
    return printWindow;
}
//# sourceMappingURL=saveHtmlAsPdf.js.map