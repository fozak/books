import { DatabaseManager } from 'backend/database/manager';
import { config } from 'dotenv';
import { Fyo } from 'fyo';
import { DummyAuthDemux } from 'fyo/tests/helpers';
import { DateTime } from 'luxon';
import path from 'path';
import setupInstance from 'src/setup/setupInstance';
import test from 'tape';
import { getFiscalYear } from 'utils/misc';
export function getTestSetupWizardOptions() {
    return {
        logo: null,
        companyName: 'Test Company',
        country: 'India',
        fullname: 'Test Person',
        email: 'test@testmyfantasy.com',
        bankName: 'Test Bank of Scriptia',
        currency: 'INR',
        fiscalYearStart: DateTime.fromJSDate(getFiscalYear('04-01', true)).toISODate(),
        fiscalYearEnd: DateTime.fromJSDate(getFiscalYear('04-01', false)).toISODate(),
        chartOfAccounts: 'India - Chart of Accounts',
    };
}
export function getTestDbPath(dbPath) {
    config();
    return dbPath ?? process.env.TEST_DB_PATH ?? ':memory:';
}
/**
 * Test Boilerplate
 *
 * The bottom three functions are test boilerplate for when
 * an initialized fyo object is to be used.
 *
 * They are required because top level await is not supported.
 *
 * Therefore setup and cleanup of the fyo object is wrapped
 * in tests which are executed serially (and awaited in order)
 * by tape.
 *
 * If `closeTestFyo` is not called the test process won't exit.
 */
export function getTestFyo() {
    return new Fyo({
        DatabaseDemux: DatabaseManager,
        AuthDemux: DummyAuthDemux,
        isTest: true,
        isElectron: false,
    });
}
const ext = '.spec.ts';
/* eslint-disable @typescript-eslint/no-misused-promises */
export function setupTestFyo(fyo, filename) {
    const testName = path.basename(filename, ext);
    return test(`setup: ${testName}`, async () => {
        const options = getTestSetupWizardOptions();
        const dbPath = getTestDbPath();
        await setupInstance(dbPath, options, fyo);
    });
}
export function closeTestFyo(fyo, filename) {
    const testName = path.basename(filename, ext);
    return test(`cleanup: ${testName}`, async () => {
        await fyo.close();
    });
}
//# sourceMappingURL=helpers.js.map