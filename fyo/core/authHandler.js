var _AuthHandler_config, _AuthHandler_session, _AuthHandler_demux, _AuthHandler_creds;
import { __classPrivateFieldGet, __classPrivateFieldSet } from "tslib";
import { AuthDemux } from 'fyo/demux/auth';
export class AuthHandler {
    constructor(fyo, Demux) {
        _AuthHandler_config.set(this, void 0);
        _AuthHandler_session.set(this, void 0);
        _AuthHandler_demux.set(this, void 0);
        _AuthHandler_creds.set(this, void 0);
        this.fyo = fyo;
        __classPrivateFieldSet(this, _AuthHandler_config, {
            serverURL: '',
            backend: 'sqlite',
            port: 8000,
        }, "f");
        __classPrivateFieldSet(this, _AuthHandler_session, {
            user: '',
            token: '',
        }, "f");
        if (Demux !== undefined) {
            __classPrivateFieldSet(this, _AuthHandler_demux, new Demux(fyo.isElectron), "f");
        }
        else {
            __classPrivateFieldSet(this, _AuthHandler_demux, new AuthDemux(fyo.isElectron), "f");
        }
    }
    set user(value) {
        __classPrivateFieldGet(this, _AuthHandler_session, "f").user = value;
    }
    get user() {
        return __classPrivateFieldGet(this, _AuthHandler_session, "f").user;
    }
    get session() {
        return { ...__classPrivateFieldGet(this, _AuthHandler_session, "f") };
    }
    get config() {
        return { ...__classPrivateFieldGet(this, _AuthHandler_config, "f") };
    }
    init() {
        return null;
    }
    async getCreds() {
        if (!__classPrivateFieldGet(this, _AuthHandler_creds, "f")) {
            __classPrivateFieldSet(this, _AuthHandler_creds, await __classPrivateFieldGet(this, _AuthHandler_demux, "f").getCreds(), "f");
        }
        return __classPrivateFieldGet(this, _AuthHandler_creds, "f");
    }
}
_AuthHandler_config = new WeakMap(), _AuthHandler_session = new WeakMap(), _AuthHandler_demux = new WeakMap(), _AuthHandler_creds = new WeakMap();
//# sourceMappingURL=authHandler.js.map