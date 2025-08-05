import { AuthDemuxBase } from 'utils/auth/types';
export class DummyAuthDemux extends AuthDemuxBase {
    // eslint-disable-next-line @typescript-eslint/require-await
    async getCreds() {
        return { errorLogUrl: '', tokenString: '', telemetryUrl: '' };
    }
}
//# sourceMappingURL=helpers.js.map