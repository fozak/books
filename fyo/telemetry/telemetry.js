var _TelemetryManager_instances, _TelemetryManager_url, _TelemetryManager_token, _TelemetryManager_started, _TelemetryManager_sendBeacon, _TelemetryManager_setCreds, _TelemetryManager_getTelemtryData;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { Verb } from './types';
import { ModelNameEnum } from 'models/types';
/**
 * # Telemetry
 * Used to check if people are using Books or not. All logging
 * happens using navigator.sendBeacon
 *
 * ## `start`
 * Used to initialize state. It should be called before any logging and after an
 * instance has loaded.
 * It is called on three events:
 * 1. When Desk is opened, i.e. when the usage starts, this also sends a
 *      Opened instance log.
 * 2. On visibility change if not started, eg: when user minimizes Books and
 *      then comes back later.
 * 3. When `log` is called, but telemetry isn't initialized.
 *
 * ## `log`
 * Used to log activity.
 *
 * ## `stop`
 * This is to be called when a session is being stopped. It's called on two events
 * 1. When the db is being changed.
 * 2. When the visiblity has changed which happens when either the app is being shut or
 *      the app is hidden.
 */
const ignoreList = [
    ModelNameEnum.AccountingLedgerEntry,
    ModelNameEnum.StockLedgerEntry,
];
export class TelemetryManager {
    constructor(fyo) {
        _TelemetryManager_instances.add(this);
        _TelemetryManager_url.set(this, '');
        _TelemetryManager_token.set(this, '');
        _TelemetryManager_started.set(this, false);
        this.fyo = fyo;
    }
    get hasCreds() {
        return !!__classPrivateFieldGet(this, _TelemetryManager_url, "f") && !!__classPrivateFieldGet(this, _TelemetryManager_token, "f");
    }
    get started() {
        return __classPrivateFieldGet(this, _TelemetryManager_started, "f");
    }
    async start(isOpened) {
        __classPrivateFieldSet(this, _TelemetryManager_started, true, "f");
        await __classPrivateFieldGet(this, _TelemetryManager_instances, "m", _TelemetryManager_setCreds).call(this);
        if (isOpened) {
            this.log(Verb.Opened, 'instance');
        }
        else {
            this.log(Verb.Resumed, 'instance');
        }
    }
    stop() {
        if (!this.started) {
            return;
        }
        this.log(Verb.Closed, 'instance');
        __classPrivateFieldSet(this, _TelemetryManager_started, false, "f");
    }
    log(verb, noun, more) {
        if (!__classPrivateFieldGet(this, _TelemetryManager_started, "f") && this.fyo.db.isConnected) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.start().then(() => __classPrivateFieldGet(this, _TelemetryManager_instances, "m", _TelemetryManager_sendBeacon).call(this, verb, noun, more));
            return;
        }
        __classPrivateFieldGet(this, _TelemetryManager_instances, "m", _TelemetryManager_sendBeacon).call(this, verb, noun, more);
    }
    async logOpened() {
        await __classPrivateFieldGet(this, _TelemetryManager_instances, "m", _TelemetryManager_setCreds).call(this);
        __classPrivateFieldGet(this, _TelemetryManager_instances, "m", _TelemetryManager_sendBeacon).call(this, Verb.Opened, 'app');
    }
}
_TelemetryManager_url = new WeakMap(), _TelemetryManager_token = new WeakMap(), _TelemetryManager_started = new WeakMap(), _TelemetryManager_instances = new WeakSet(), _TelemetryManager_sendBeacon = function _TelemetryManager_sendBeacon(verb, noun, more) {
    if (!this.hasCreds ||
        this.fyo.store.skipTelemetryLogging ||
        ignoreList.includes(noun)) {
        return;
    }
    const telemetryData = __classPrivateFieldGet(this, _TelemetryManager_instances, "m", _TelemetryManager_getTelemtryData).call(this, verb, noun, more);
    const data = JSON.stringify({
        token: __classPrivateFieldGet(this, _TelemetryManager_token, "f"),
        telemetryData,
    });
    navigator.sendBeacon(__classPrivateFieldGet(this, _TelemetryManager_url, "f"), data);
}, _TelemetryManager_setCreds = async function _TelemetryManager_setCreds() {
    if (this.hasCreds) {
        return;
    }
    const { telemetryUrl, tokenString } = await this.fyo.auth.getCreds();
    __classPrivateFieldSet(this, _TelemetryManager_url, telemetryUrl, "f");
    __classPrivateFieldSet(this, _TelemetryManager_token, tokenString, "f");
}, _TelemetryManager_getTelemtryData = function _TelemetryManager_getTelemtryData(verb, noun, more) {
    const countryCode = this.fyo.singles.SystemSettings?.countryCode;
    return {
        country: countryCode ?? '',
        language: this.fyo.store.language,
        deviceId: this.fyo.store.deviceId || (this.fyo.config.get('deviceId') ?? '-'),
        instanceId: this.fyo.store.instanceId,
        version: this.fyo.store.appVersion,
        openCount: this.fyo.store.openCount,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, -1),
        platform: this.fyo.store.platform,
        verb,
        noun,
        more,
    };
};
//# sourceMappingURL=telemetry.js.map