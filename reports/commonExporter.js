import { t } from 'fyo';
import { Verb } from 'fyo/telemetry/types';
import { getSavePath, showExportInFolder } from 'src/utils/ui';
import { getIsNullOrUndef } from 'utils';
import { generateCSV } from 'utils/csvParser';
export default function getCommonExportActions(report) {
    const exportExtention = ['csv', 'json'];
    return exportExtention.map((ext) => ({
        group: t `Export`,
        label: ext.toUpperCase(),
        type: 'primary',
        action: async () => {
            await exportReport(ext, report);
        },
    }));
}
async function exportReport(extention, report) {
    const { filePath, canceled } = await getSavePath(report.reportName, extention);
    if (canceled || !filePath) {
        return;
    }
    let data = '';
    if (extention === 'csv') {
        data = getCsvData(report);
    }
    else if (extention === 'json') {
        data = getJsonData(report);
    }
    if (!data.length) {
        return;
    }
    await saveExportData(data, filePath);
    report.fyo.telemetry.log(Verb.Exported, report.reportName, { extention });
}
function getJsonData(report) {
    const exportObject = {
        columns: [],
        rows: [],
        filters: {},
        timestamp: '',
        reportName: '',
        softwareName: '',
        softwareVersion: '',
    };
    const columns = report.columns;
    const displayPrecision = report.fyo.singles.SystemSettings?.displayPrecision ?? 2;
    /**
     * Set columns as list of fieldname, label
     */
    exportObject.columns = columns.map(({ fieldname, label }) => ({
        fieldname,
        label,
    }));
    /**
     * Set rows as fieldname: value map
     */
    for (const row of report.reportData) {
        if (row.isEmpty) {
            continue;
        }
        const rowObj = {};
        for (let c = 0; c < row.cells.length; c++) {
            const { label } = columns[c];
            const cell = getValueFromCell(row.cells[c], displayPrecision);
            rowObj[label] = cell;
        }
        exportObject.rows.push(rowObj);
    }
    /**
     * Set filter map
     */
    for (const { fieldname } of report.filters) {
        const value = report.get(fieldname);
        if (getIsNullOrUndef(value)) {
            continue;
        }
        exportObject.filters[fieldname] = String(value);
    }
    /**
     * Metadata
     */
    exportObject.timestamp = new Date().toISOString();
    exportObject.reportName = report.reportName;
    exportObject.softwareName = 'Frappe Books';
    exportObject.softwareVersion = report.fyo.store.appVersion;
    return JSON.stringify(exportObject);
}
export function getCsvData(report) {
    const csvMatrix = convertReportToCSVMatrix(report);
    return generateCSV(csvMatrix);
}
function convertReportToCSVMatrix(report) {
    const displayPrecision = report.fyo.singles.SystemSettings?.displayPrecision ?? 2;
    const reportData = report.reportData;
    const columns = report.columns;
    const csvdata = [];
    csvdata.push(columns.map((c) => c.label));
    for (const row of reportData) {
        if (row.isEmpty) {
            csvdata.push(Array(row.cells.length).fill(''));
            continue;
        }
        const csvrow = [];
        for (let c = 0; c < row.cells.length; c++) {
            const cell = getValueFromCell(row.cells[c], displayPrecision);
            csvrow.push(cell);
        }
        csvdata.push(csvrow);
    }
    return csvdata;
}
function getValueFromCell(cell, displayPrecision) {
    const rawValue = cell.rawValue;
    if (rawValue instanceof Date) {
        return rawValue.toISOString();
    }
    if (typeof rawValue === 'number') {
        const value = rawValue.toFixed(displayPrecision);
        /**
         * remove insignificant zeroes
         */
        if (value.endsWith('0'.repeat(displayPrecision))) {
            return value.slice(0, -displayPrecision - 1);
        }
        return value;
    }
    if (getIsNullOrUndef(cell)) {
        return '';
    }
    return rawValue;
}
export async function saveExportData(data, filePath, message) {
    await ipc.saveData(data, filePath);
    message ?? (message = t `Export Successful`);
    showExportInFolder(message, filePath);
}
//# sourceMappingURL=commonExporter.js.map