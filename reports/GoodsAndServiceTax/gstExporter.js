import { Verb } from 'fyo/telemetry/types';
import { DateTime } from 'luxon';
import { ModelNameEnum } from 'models/types';
import { codeStateMap } from 'regional/in';
import { showDialog } from 'src/utils/interactive';
import { invertMap } from 'utils';
import { getCsvData, saveExportData } from '../commonExporter';
import { TransferTypeEnum } from './types';
import { getSavePath } from 'src/utils/ui';
const GST = {
    'GST-0': 0,
    'GST-0.25': 0.25,
    'GST-3': 3,
    'GST-5': 5,
    'GST-6': 6,
    'GST-12': 12,
    'GST-18': 18,
    'GST-28': 28,
    'IGST-0': 0,
    'IGST-0.25': 0.25,
    'IGST-3': 3,
    'IGST-5': 5,
    'IGST-6': 6,
    'IGST-12': 12,
    'IGST-18': 18,
    'IGST-28': 28,
};
const CSGST = {
    'GST-0': 0,
    'GST-0.25': 0.125,
    'GST-3': 1.5,
    'GST-5': 2.5,
    'GST-6': 3,
    'GST-12': 6,
    'GST-18': 9,
    'GST-28': 14,
};
const IGST = {
    'IGST-0.25': 0.25,
    'IGST-3': 3,
    'IGST-5': 5,
    'IGST-6': 6,
    'IGST-12': 12,
    'IGST-18': 18,
    'IGST-28': 28,
};
export default function getGSTRExportActions(report) {
    const exportExtention = ['csv', 'json'];
    return exportExtention.map((ext) => ({
        group: `Export`,
        label: ext.toUpperCase(),
        type: 'primary',
        action: async () => {
            await exportReport(ext, report);
        },
    }));
}
async function exportReport(extention, report) {
    const canExport = await getCanExport(report);
    if (!canExport) {
        return;
    }
    const { filePath, canceled } = await getSavePath(report.reportName, extention);
    if (canceled || !filePath) {
        return;
    }
    let data = '';
    if (extention === 'csv') {
        data = getCsvData(report);
    }
    else if (extention === 'json') {
        data = await getGstrJsonData(report);
    }
    if (!data.length) {
        return;
    }
    await saveExportData(data, filePath);
    report.fyo.telemetry.log(Verb.Exported, report.reportName, { extention });
}
async function getCanExport(report) {
    const gstin = await report.fyo.getValue(ModelNameEnum.AccountingSettings, 'gstin');
    if (gstin) {
        return true;
    }
    await showDialog({
        title: report.fyo.t `Cannot Export`,
        detail: report.fyo.t `Please set GSTIN in General Settings.`,
        type: 'error',
    });
    return false;
}
export async function getGstrJsonData(report) {
    const toDate = report.toDate;
    const transferType = report.transferType;
    const gstin = await report.fyo.getValue(ModelNameEnum.AccountingSettings, 'gstin');
    const gstData = {
        version: 'GST3.0.4',
        hash: 'hash',
        gstin: gstin,
        fp: DateTime.fromISO(toDate).toFormat('MMyyyy'),
    };
    if (transferType === TransferTypeEnum.B2B) {
        gstData.b2b = await generateB2bData(report);
    }
    else if (transferType === TransferTypeEnum.B2CL) {
        gstData.b2cl = await generateB2clData(report);
    }
    else if (transferType === TransferTypeEnum.B2CS) {
        gstData.b2cs = generateB2csData(report);
    }
    return JSON.stringify(gstData);
}
async function generateB2bData(report) {
    const fyo = report.fyo;
    const b2b = [];
    const schemaName = report.gstrType === 'GSTR-1'
        ? ModelNameEnum.SalesInvoiceItem
        : ModelNameEnum.PurchaseInvoiceItem;
    const parentSchemaName = report.gstrType === 'GSTR-1'
        ? ModelNameEnum.SalesInvoice
        : ModelNameEnum.PurchaseInvoice;
    for (const row of report.gstrRows ?? []) {
        const invRecord = {
            inum: row.invNo,
            idt: DateTime.fromJSDate(row.invDate).toFormat('dd-MM-yyyy'),
            val: row.invAmt,
            pos: row.gstin && row.gstin.substring(0, 2),
            rchrg: row.reverseCharge,
            inv_typ: 'R',
            itms: [],
        };
        const exchangeRate = (await fyo.db.getAllRaw(parentSchemaName, {
            fields: ['exchangeRate'],
            filters: { name: invRecord.inum },
        }))[0].exchangeRate;
        const items = await fyo.db.getAllRaw(schemaName, {
            fields: ['amount', 'tax', 'hsnCode'],
            filters: { parent: invRecord.inum },
        });
        items.forEach((item) => {
            const hsnCode = item.hsnCode;
            const tax = item.tax;
            const baseAmount = fyo
                .pesa(item.amount ?? 0)
                .mul(exchangeRate);
            const itemRecord = {
                num: hsnCode,
                itm_det: {
                    txval: baseAmount.float,
                    rt: GST[tax],
                    csamt: 0,
                    camt: fyo
                        .pesa(CSGST[tax] ?? 0)
                        .mul(baseAmount)
                        .div(100).float,
                    samt: fyo
                        .pesa(CSGST[tax] ?? 0)
                        .mul(baseAmount)
                        .div(100).float,
                    iamt: fyo
                        .pesa(IGST[tax] ?? 0)
                        .mul(baseAmount)
                        .div(100).float,
                },
            };
            invRecord.itms.push(itemRecord);
        });
        const customerRecord = b2b.find((b) => b.ctin === row.gstin);
        const customer = {
            ctin: row.gstin,
            inv: [],
        };
        if (customerRecord) {
            customerRecord.inv.push(invRecord);
        }
        else {
            customer.inv.push(invRecord);
            b2b.push(customer);
        }
    }
    return b2b;
}
async function generateB2clData(report) {
    const fyo = report.fyo;
    const b2cl = [];
    const stateCodeMap = invertMap(codeStateMap);
    const schemaName = report.gstrType === 'GSTR-1'
        ? ModelNameEnum.SalesInvoiceItem
        : ModelNameEnum.PurchaseInvoiceItem;
    const parentSchemaName = report.gstrType === 'GSTR-1'
        ? ModelNameEnum.SalesInvoice
        : ModelNameEnum.PurchaseInvoice;
    for (const row of report.gstrRows ?? []) {
        const invRecord = {
            inum: row.invNo,
            idt: DateTime.fromJSDate(row.invDate).toFormat('dd-MM-yyyy'),
            val: row.invAmt,
            itms: [],
        };
        const exchangeRate = (await fyo.db.getAllRaw(parentSchemaName, {
            fields: ['exchangeRate'],
            filters: { name: invRecord.inum },
        }))[0].exchangeRate;
        const items = await fyo.db.getAllRaw(schemaName, {
            fields: ['amount', 'tax', 'hsnCode'],
            filters: { parent: invRecord.inum },
        });
        items.forEach((item) => {
            const hsnCode = item.hsnCode;
            const tax = item.tax;
            const baseAmount = fyo
                .pesa(item.amount ?? 0)
                .mul(exchangeRate);
            const itemRecord = {
                num: hsnCode,
                itm_det: {
                    txval: baseAmount.float,
                    rt: GST[tax] ?? 0,
                    csamt: 0,
                    iamt: fyo
                        .pesa(row.rate ?? 0)
                        .mul(baseAmount)
                        .div(100).float,
                },
            };
            invRecord.itms.push(itemRecord);
        });
        const stateRecord = b2cl.find((b) => b.pos === stateCodeMap[row.place]);
        const stateInvoiceRecord = {
            pos: stateCodeMap[row.place],
            inv: [],
        };
        if (stateRecord) {
            stateRecord.inv.push(invRecord);
        }
        else {
            stateInvoiceRecord.inv.push(invRecord);
            b2cl.push(stateInvoiceRecord);
        }
    }
    return b2cl;
}
function generateB2csData(report) {
    const stateCodeMap = invertMap(codeStateMap);
    const b2cs = [];
    for (const row of report.gstrRows ?? []) {
        const invRecord = {
            sply_ty: row.inState ? 'INTRA' : 'INTER',
            pos: stateCodeMap[row.place],
            typ: 'OE',
            txval: row.taxVal,
            rt: row.rate,
            iamt: !row.inState ? (row.taxVal * row.rate) / 100 : 0,
            camt: row.inState ? row.cgstAmt ?? 0 : 0,
            samt: row.inState ? row.sgstAmt ?? 0 : 0,
            csamt: 0,
        };
        b2cs.push(invRecord);
    }
    return b2cs;
}
//# sourceMappingURL=gstExporter.js.map