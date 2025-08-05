var _AuthDemux_isElectron;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { AuthDemuxBase } from 'utils/auth/types';
export class AuthDemux extends AuthDemuxBase {
    constructor(isElectron) {
        super();
        _AuthDemux_isElectron.set(this, false);
        __classPrivateFieldSet(this, _AuthDemux_isElectron, isElectron, "f");
    }
    async getCreds() {
        if (__classPrivateFieldGet(this, _AuthDemux_isElectron, "f")) {
            return await ipc.getCreds();
        }
        else {
            return { errorLogUrl: '', tokenString: '', telemetryUrl: '' };
        }
    }
}
_AuthDemux_isElectron = new WeakMap();
//# sourceMappingURL=auth.js.map