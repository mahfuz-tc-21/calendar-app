package com.calendarapp.secure;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AutoUpdate")
public class AutoUpdatePlugin extends Plugin {
    private static final String TAG = "AutoUpdatePlugin";

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            String packageName = context.getPackageName();
            String versionName = context.getPackageManager().getPackageInfo(packageName, 0).versionName;
            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = context.getPackageManager().getPackageInfo(packageName, 0).getLongVersionCode();
            } else {
                versionCode = context.getPackageManager().getPackageInfo(packageName, 0).versionCode;
            }

            JSObject ret = new JSObject();
            ret.put("versionName", versionName);
            ret.put("versionCode", versionCode);
            ret.put("packageName", packageName);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get app info", e);
            call.reject("Failed to get package info: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
            ret.put("allowed", canInstall);
        } else {
            ret.put("allowed", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Failed to launch unknown sources settings", e);
                // Fallback: Open general security/install settings
                Intent intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlString = call.getString("url");
        String sha256 = call.getString("sha256");

        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        if (!urlString.startsWith("https://")) {
            call.reject("Only HTTPS URLs are allowed for security");
            return;
        }

        new Thread(() -> {
            File apkFile = null;
            try {
                Context context = getContext();
                apkFile = new File(context.getCacheDir(), "update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                URL url = new URL(urlString);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.connect();

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new Exception("Server returned HTTP " + connection.getResponseCode() + " " + connection.getResponseMessage());
                }

                int fileLength = connection.getContentLength();
                InputStream input = new BufferedInputStream(connection.getInputStream(), 8192);
                FileOutputStream output = new FileOutputStream(apkFile);
                MessageDigest digest = MessageDigest.getInstance("SHA-256");

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastProgressTime = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);
                    digest.update(data, 0, count);

                    long now = System.currentTimeMillis();
                    if (fileLength > 0 && now - lastProgressTime > 150) {
                        lastProgressTime = now;
                        int progress = (int) (total * 100 / fileLength);
                        JSObject progressObj = new JSObject();
                        progressObj.put("progress", progress);
                        progressObj.put("status", "downloading");
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                output.close();
                input.close();

                // Final 100% progress
                JSObject progressObj = new JSObject();
                progressObj.put("progress", 100);
                progressObj.put("status", "downloading");
                notifyListeners("downloadProgress", progressObj);

                // Compute SHA-256
                byte[] hashBytes = digest.digest();
                StringBuilder sb = new StringBuilder();
                for (byte b : hashBytes) {
                    sb.append(String.format("%02x", b));
                }
                String calculatedHash = sb.toString();

                if (sha256 != null && !sha256.isEmpty()) {
                    if (!calculatedHash.equalsIgnoreCase(sha256)) {
                        if (apkFile.exists()) {
                            apkFile.delete();
                        }
                        throw new Exception("SHA-256 verification failed. Expected: " + sha256 + ", Calculated: " + calculatedHash);
                    }
                }

                // Launch package installer
                installApkFile(context, apkFile, call);

            } catch (Exception e) {
                Log.e(TAG, "Download or installation error", e);
                if (apkFile != null && apkFile.exists()) {
                    apkFile.delete();
                }
                JSObject errorObj = new JSObject();
                errorObj.put("error", e.getMessage());
                errorObj.put("status", "failed");
                notifyListeners("downloadProgress", errorObj);
                call.reject(e.getMessage());
            }
        }).start();

        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    private void installApkFile(Context context, File apkFile, PluginCall call) throws Exception {
        if (!apkFile.exists()) {
            throw new Exception("APK file does not exist");
        }

        Uri apkUri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apkFile);
        } else {
            apkUri = Uri.fromFile(apkFile);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);

        JSObject installObj = new JSObject();
        installObj.put("status", "installing");
        notifyListeners("downloadProgress", installObj);
    }

    @PluginMethod
    public void setStatusBarTheme(PluginCall call) {
        String theme = call.getString("theme");
        if (theme == null) {
            call.reject("Theme is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    android.view.Window window = getActivity().getWindow();
                    int color = theme.equals("dark") ? android.graphics.Color.parseColor("#080c14") : android.graphics.Color.parseColor("#f9fafb");
                    window.setStatusBarColor(color);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.view.View decorView = window.getDecorView();
                        int flags = decorView.getSystemUiVisibility();
                        if (theme.equals("dark")) {
                            flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        } else {
                            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        }
                        decorView.setSystemUiVisibility(flags);
                    }
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setNavigationBarTheme(PluginCall call) {
        String theme = call.getString("theme");
        if (theme == null) {
            call.reject("Theme is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    android.view.Window window = getActivity().getWindow();
                    int color = theme.equals("dark") ? android.graphics.Color.parseColor("#080c14") : android.graphics.Color.parseColor("#f9fafb");
                    window.setNavigationBarColor(color);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        android.view.View decorView = window.getDecorView();
                        int flags = decorView.getSystemUiVisibility();
                        if (theme.equals("dark")) {
                            flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        } else {
                            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                        decorView.setSystemUiVisibility(flags);
                    }
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }
}
