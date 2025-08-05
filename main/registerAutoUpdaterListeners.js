import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { emitMainProcessError } from '../backend/helpers';
import { isNetworkError } from './helpers';
export default function registerAutoUpdaterListeners(main) {
    autoUpdater.autoDownload = false;
    autoUpdater.allowPrerelease = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (error) => {
        if (!main.checkedForUpdate) {
            main.checkedForUpdate = true;
        }
        if (isNetworkError(error)) {
            return;
        }
        emitMainProcessError(error);
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    autoUpdater.on('update-available', async (info) => {
        const currentVersion = app.getVersion();
        const nextVersion = info.version;
        const isCurrentBeta = currentVersion.includes('beta');
        const isNextBeta = nextVersion.includes('beta');
        let downloadUpdate = true;
        if (!isCurrentBeta && isNextBeta) {
            const option = await dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: `Download version ${nextVersion}?`,
                buttons: ['Yes', 'No'],
            });
            downloadUpdate = option.response === 0;
        }
        if (!downloadUpdate) {
            return;
        }
        await autoUpdater.downloadUpdate();
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    autoUpdater.on('update-downloaded', async () => {
        const option = await dialog.showMessageBox({
            type: 'info',
            title: 'Update Downloaded',
            message: 'Restart Frappe Books to install update?',
            buttons: ['Yes', 'No'],
        });
        if (option.response === 1) {
            return;
        }
        autoUpdater.quitAndInstall();
    });
}
//# sourceMappingURL=registerAutoUpdaterListeners.js.map