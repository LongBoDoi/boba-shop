package com.manhlong.bobashop.phaser;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Hand a downloaded .apk to Android's own package installer.
 *
 * This is the half of "there is a new version" that an over-the-air update cannot do: the shell
 * itself has changed, so the file has to be installed. Because every release is signed with the
 * same key (see android/app/build.gradle), Android treats it as an update of this app rather than
 * a new one, and **the shop survives**.
 *
 * Two things here are not optional. The installer is another app, so the file cannot be handed
 * over as a `file://` path — it goes through the FileProvider already declared in the manifest,
 * which is why the download lands in the cache directory that `res/xml/file_paths.xml` shares. And
 * the intent needs `FLAG_GRANT_READ_URI_PERMISSION`, or the installer opens on an empty screen.
 *
 * Whether this app may install anything at all is the player's to decide: Android shows its own
 * "allow from this source" prompt the first time, and nothing here can or should skip it.
 */
@CapacitorPlugin(name = "Install")
public class InstallPlugin extends Plugin {

    @PluginMethod
    public void openApk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("No file to install");
            return;
        }
        File file = new File(path.replaceFirst("^file://", ""));
        if (!file.exists()) {
            call.reject("The downloaded file is not there: " + file.getAbsolutePath());
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("The installer could not be opened: " + error.getMessage(), error);
        }
    }
}
