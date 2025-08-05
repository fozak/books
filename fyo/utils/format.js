import { DateTime } from 'luxon';
import { FieldTypeEnum } from 'schemas/types';
import { getIsNullOrUndef, safeParseFloat, titleCase } from 'utils';
import { isPesa } from '.';
import { DEFAULT_CURRENCY, DEFAULT_DATE_FORMAT, DEFAULT_DISPLAY_PRECISION, DEFAULT_LOCALE, } from './consts';
export function format(value, df, doc, fyo) {
    if (!df) {
        return String(value);
    }
    const field = getField(df);
    if (field.fieldtype === FieldTypeEnum.Float) {
        return Number(value).toFixed(fyo.singles.SystemSettings?.displayPrecision);
    }
    if (field.fieldtype === FieldTypeEnum.Int) {
        return Math.trunc(Number(value)).toString();
    }
    if (field.fieldtype === FieldTypeEnum.Currency) {
        return formatCurrency(value, field, doc, fyo);
    }
    if (field.fieldtype === FieldTypeEnum.Date) {
        return formatDate(value, fyo);
    }
    if (field.fieldtype === FieldTypeEnum.Datetime) {
        return formatDatetime(value, fyo);
    }
    if (field.fieldtype === FieldTypeEnum.Check) {
        return titleCase(Boolean(value).toString());
    }
    if (getIsNullOrUndef(value)) {
        return '';
    }
    return String(value);
}
function toDatetime(value) {
    if (typeof value === 'string') {
        return DateTime.fromISO(value);
    }
    else if (value instanceof Date) {
        return DateTime.fromJSDate(value);
    }
    else if (typeof value === 'number') {
        return DateTime.fromSeconds(value);
    }
    return null;
}
function formatDatetime(value, fyo) {
    if (value == null) {
        return '';
    }
    const dateFormat = fyo.singles.SystemSettings?.dateFormat ?? DEFAULT_DATE_FORMAT;
    const dateTime = toDatetime(value);
    if (!dateTime) {
        return '';
    }
    const formattedDatetime = dateTime.toFormat(`${dateFormat} HH:mm:ss`);
    if (value === 'Invalid DateTime') {
        return '';
    }
    return formattedDatetime;
}
function formatDate(value, fyo) {
    if (value == null) {
        return '';
    }
    const dateFormat = fyo.singles.SystemSettings?.dateFormat ?? DEFAULT_DATE_FORMAT;
    const dateTime = toDatetime(value);
    if (!dateTime) {
        return '';
    }
    const formattedDate = dateTime.toFormat(dateFormat);
    if (value === 'Invalid DateTime') {
        return '';
    }
    return formattedDate;
}
function formatCurrency(value, field, doc, fyo) {
    const currency = getCurrency(field, doc, fyo);
    let valueString;
    try {
        valueString = formatNumber(value, fyo);
    }
    catch (err) {
        err.message += ` value: '${String(value)}', type: ${typeof value}`;
        throw err;
    }
    const currencySymbol = fyo.currencySymbols[currency];
    if (currencySymbol !== undefined) {
        return currencySymbol + ' ' + valueString;
    }
    return valueString;
}
function formatNumber(value, fyo) {
    const numberFormatter = getNumberFormatter(fyo);
    if (typeof value === 'number') {
        value = fyo.pesa(value.toFixed(20));
    }
    if (isPesa(value)) {
        const floatValue = safeParseFloat(value.round());
        return numberFormatter.format(floatValue);
    }
    const floatValue = safeParseFloat(value);
    const formattedNumber = numberFormatter.format(floatValue);
    if (formattedNumber === 'NaN') {
        throw Error(`invalid value passed to formatNumber: '${String(value)}' of type ${typeof value}`);
    }
    return formattedNumber;
}
function getNumberFormatter(fyo) {
    if (fyo.currencyFormatter) {
        return fyo.currencyFormatter;
    }
    const locale = fyo.singles.SystemSettings?.locale ?? DEFAULT_LOCALE;
    const display = fyo.singles.SystemSettings?.displayPrecision ??
        DEFAULT_DISPLAY_PRECISION;
    return (fyo.currencyFormatter = Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: display,
    }));
}
function getCurrency(field, doc, fyo) {
    const defaultCurrency = fyo.singles.SystemSettings?.currency ?? DEFAULT_CURRENCY;
    let getCurrency = doc?.getCurrencies?.[field.fieldname];
    if (getCurrency !== undefined) {
        return getCurrency();
    }
    getCurrency = doc?.parentdoc?.getCurrencies[field.fieldname];
    if (getCurrency !== undefined) {
        return getCurrency();
    }
    return defaultCurrency;
}
function getField(df) {
    if (typeof df === 'string') {
        return {
            label: '',
            fieldname: '',
            fieldtype: df,
        };
    }
    return df;
}
//# sourceMappingURL=format.js.map