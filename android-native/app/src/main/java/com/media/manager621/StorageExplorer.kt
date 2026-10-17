package com.media.manager621

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.provider.DocumentsContract
import android.graphics.BitmapFactory
import android.media.MediaPlayer
import android.text.InputType
import android.text.method.PasswordTransformationMethod
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.FragmentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import java.util.concurrent.Executor

import android.util.Log

internal fun MainActivity.hasAllFilesAccess(): Boolean =
        Build.VERSION.SDK_INT >= 30 && Environment.isExternalStorageManager()


internal fun MainActivity.render() {
        if (!unlocked) { unlock(); return }
        layout("Media Manager 621 • File Explorer")
        if (!hasAllFilesAccess()) {
            note("Storage setup • Android has not granted broad access to shared internal storage. Your files are not missing. Approve access in Android Settings to open the internal storage explorer automatically.")
            if (Build.VERSION.SDK_INT >= 30) {
                button("1. Enable internal storage access") { requestAllFilesAccess() }
                note("In Android Settings, enable \"Allow access to manage all files\" for Media Manager 621, then return to the app. Android may use slightly different wording.")
            } else {
                note("On Android 10 or older, select a folder through the system picker. This alpha does not support full-storage permissions on those Android versions.")
            }
            button("2. Choose a folder instead") { folderPicker.launch(null) }
            button("Open previously approved folder") {
                val saved = getSharedPreferences("mm621-folders", MODE_PRIVATE).getString("last", null)
                if (saved == null) error("No approved folder is saved yet.")
                else {
                    currentFolder = DocumentFile.fromTreeUri(this, Uri.parse(saved))
                    render()
                }
            }
            button("Private Vault") { showVault() }
        button("Security & app lock") { showSecuritySettings() }
            button("Installed apps") { showInstalledApps() }
            button("Security & app lock") { showSecuritySettings() }
            val granted = currentFolder
            if (granted == null) {
                note("No folder is currently connected. Choose an option above to display files.")
                return
            }
        }
        note("File explorer and encrypted vault. Android controls storage approval; restricted system folders remain protected.")
        button("Choose / connect device folder") { folderPicker.launch(null) }
        button("Open previously granted folder") {
            val saved = getSharedPreferences("mm621-folders", MODE_PRIVATE).getString("last", null)
            if (saved == null) error("No previously selected folder")
            else {
                currentFolder = DocumentFile.fromTreeUri(this, Uri.parse(saved))
                render()
            }
        }
        button("Grant broad storage access (Android Settings)") { requestAllFilesAccess() }
        if (hasAllFilesAccess()) {
            button("Browse internal storage (native)") { browseInternal(Environment.getExternalStorageDirectory()) }
        }
        button("Installed apps (launchable)") { showInstalledApps() }
        button("Security & app lock") { showSecuritySettings() }
        button("Private Vault") { showVault() }
        if (pin.lockEnabled) button("Lock now") { unlocked = false; unlock() }
        val folder = currentFolder
        if (folder == null) {
            note("Choose a folder to browse. File access is limited to what Android allows.")
            return
        }
        note("Current folder: ${folder.name ?: "Selected storage"}")
        if (folder.parentFile != null) button("⬆ Parent folder") {
            currentFolder = folder.parentFile
            render()
        }
        button("Create folder here") { textDialog("New folder name") { name ->
            try {
                require(name.isNotBlank() && !name.contains('/'))
                requireNotNull(folder.createDirectory(name)) { "Provider denied folder creation" }
                render()
            } catch (e: Exception) { error(e.message ?: "Cannot create folder") }
        } }
        val children = try { folder.listFiles().sortedWith(compareByDescending<DocumentFile> { it.isDirectory }.thenBy { it.name?.lowercase() }) }
        catch (e: Exception) { error("Cannot list folder: ${e.message}"); emptyList() }
        note("${children.size} items. Tap a file to open; long-press to manage.")
        for (item in children.take(1500)) {
            val name = item.name ?: "(unnamed)"
            val entry = TextView(this).apply {
                text = (if (item.isDirectory) "📁 " else "📄 ") + name
                textSize = 17f
                setTextColor(0xfff1e8d8.toInt())
                setPadding(14, 17, 14, 17)
                setOnClickListener {
                    if (item.isDirectory) { currentFolder = item; render() }
                    else openFile(item)
                }
                setOnLongClickListener { manage(item); true }
            }
            content.addView(entry)
        }
        if (children.size > 1500) note("Only the first 1,500 entries are displayed. Browse smaller folders to continue.")
    }


internal fun MainActivity.formatSize(bytes: Long): String = when {
        bytes >= 1_073_741_824 -> "%.1f GB".format(bytes.toDouble() / 1_073_741_824)
        bytes >= 1_048_576 -> "%.1f MB".format(bytes.toDouble() / 1_048_576)
        else -> "$bytes B"
    }


internal fun MainActivity.browseInternal(directory: java.io.File) {
        if (!unlocked) { unlock(); return }
        val root = Environment.getExternalStorageDirectory().canonicalFile
        val folder = directory.canonicalFile
        if (folder != root && !folder.toPath().startsWith(root.toPath())) {
            error("Cannot browse outside approved storage"); return
        }
        if (!hasAllFilesAccess()) { render(); return }
        layout("Internal storage • ${folder.name}")
        val stat = android.os.StatFs(root.path)
        val capacity = stat.totalBytes
        val available = stat.availableBytes
        note("Internal shared storage · ${formatSize(capacity - available)} used of ${formatSize(capacity)} · ${formatSize(available)} free")
        button("Installed apps (launchable)") { showInstalledApps() }
        button("Private Vault") { showVault() }
        button("Lock now") { unlocked = false; unlock() }
        button("Choose another folder / SD card") { folderPicker.launch(null) }
        button("Browse approved folder") { render() }
        button("Search in this folder") { textDialog("Filter names (current folder)", query) { query = it; browseInternal(folder) } }
        if (query.isNotBlank()) button("Clear search: $query") { query = ""; browseInternal(folder) }
        button(if (sortBySize) "Sort: size ↓" else "Sort: name A–Z") { sortBySize = !sortBySize; browseInternal(folder) }
        button(if (showHidden) "Hide dotfiles" else "Show dotfiles") { showHidden = !showHidden; browseInternal(folder) }
        if (clipboard != null) button("Paste ${if (cutClipboard) "move" else "copy"}: ${clipboard?.name}") { pasteInto(folder) }
        if (clipboard != null) button("Clear copy/move selection") { clipboard = null; browseInternal(folder) }
        if (folder != root) button("⬆ Parent") { browseInternal(folder.parentFile ?: root) }
        button("Create new folder") { textDialog("Folder name") { name ->
            val target = java.io.File(folder, name)
            if (name.isNotBlank() && !name.contains('/') && target.mkdir()) browseInternal(folder)
            else error("Cannot create folder")
        } }
        val children = try {
            val entries = folder.listFiles()?.asSequence()?.filter { (showHidden || !it.name.startsWith(".")) && it.name.contains(query, ignoreCase = true) }?.toList() ?: emptyList()
            if (sortBySize) entries.sortedWith(compareByDescending<java.io.File> { it.isDirectory }.thenByDescending { it.length() })
            else entries.sortedWith(compareByDescending<java.io.File> { it.isDirectory }.thenBy { it.name.lowercase() })
        }
        catch (e: Exception) { error("Storage access failed: ${e.message}"); emptyList() }
        note("${children.size} entries · Android still restricts protected system folders.")
        for (item in children.take(1500)) {
            val row = TextView(this).apply {
                text = (if (item.isDirectory) "📁 " else "📄 ") + item.name +
                    (if (item.isFile) " · ${formatSize(item.length())}" else "")
                textSize = 17f
                setTextColor(0xfff1e8d8.toInt())
                setPadding(14, 17, 14, 17)
                setOnClickListener {
                    if (item.isDirectory) browseInternal(item) else previewNativeFile(item)
                }
                setOnLongClickListener { manageInternal(item, folder); true }
            }
            content.addView(row)
        }
        if (children.size > 1500) note("Showing first 1,500 entries.")
        button("Refresh folder") { browseInternal(folder) }
    }


internal fun MainActivity.previewNativeFile(file: java.io.File) {
        // FileProvider creates a temporary content URI for our own viewer.
        val uri = androidx.core.content.FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        val mime = android.webkit.MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
        previewBack = { browseInternal(file.parentFile ?: Environment.getExternalStorageDirectory()) }
        openFile(uri, file.name, mime, file.length())
    }


internal fun MainActivity.showInstalledApps() {
        if (!unlocked) { unlock(); return }
        layout("Installed apps • launchable")
        button("← Internal storage") { openHome() }
        note("Shows launchable apps visible to Android's package manager. Hidden, system-only and non-launchable packages may not appear. App-private data is not accessible.")
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val pm = packageManager
        val apps = pm.queryIntentActivities(intent, 0)
            .distinctBy { it.activityInfo.packageName }
            .sortedBy { it.loadLabel(pm).toString().lowercase() }
        note("${apps.size} visible apps")
        for (app in apps) {
            val pkg = app.activityInfo.packageName
            val label = app.loadLabel(pm).toString()
            button("$label · $pkg") {
                AlertDialog.Builder(this).setTitle(label)
                    .setMessage("Package: $pkg\\nManage this app through Android's App Info screen.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("App info") { _, _ ->
                        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:$pkg")))
                    }.show()
            }
        }
    }


internal fun MainActivity.requestAllFilesAccess() {
        if (Build.VERSION.SDK_INT < 30) {
            error("All-files special permission applies to Android 11+.")
            return
        }
        if (Environment.isExternalStorageManager()) {
            browseInternal(Environment.getExternalStorageDirectory())
            return
        }
        awaitingAllFilesPermission = true
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            try { startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)) }
            catch (e: Exception) { awaitingAllFilesPermission = false; error("Cannot open storage settings: ${e.message}") }
        }
    }

