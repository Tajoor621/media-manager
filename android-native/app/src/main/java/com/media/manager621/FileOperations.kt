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

internal fun MainActivity.manageInternal(file: java.io.File, parent: java.io.File) {
        val options = arrayOf("Details", "Rename", "Hide / unhide", "Copy to another folder", "Move to another folder", "Copy into this folder", "Create ZIP", "Extract ZIP", "Delete")
        AlertDialog.Builder(this).setTitle(file.name).setItems(options) { _, which ->
            when (which) {
                0 -> showNativeDetails(file)
                1, 2 -> {
                    val targetName = if (which == 2) {
                        if (file.name.startsWith(".")) file.name.removePrefix(".") else ".${file.name}"
                    } else null
                    val action: (String) -> Unit = { name ->
                        val dest = java.io.File(parent, name)
                        if (name.isBlank() || name.contains('/') || dest.exists() || !file.renameTo(dest))
                            error("Rename denied or name already exists")
                        else browseInternal(parent)
                    }
                    if (targetName != null) action(targetName)
                    else textDialog("Rename", file.name, action)
                }
                3, 4 -> {
                    clipboard = file
                    cutClipboard = which == 4
                    toast("Navigate to a destination folder, then tap Paste.")
                    browseInternal(parent)
                }
                5 -> {
                    if (file.isDirectory) error("Use Copy to another folder for directory copies.")
                    else textDialog("Copy as", "Copy of ${file.name}") { name ->
                        try {
                            val dest = java.io.File(parent, name)
                            require(name.isNotBlank() && !name.contains('/') && !dest.exists())
                            file.inputStream().use { input -> dest.outputStream().use { input.copyTo(it) } }
                            browseInternal(parent)
                        } catch (e: Exception) { error("Copy failed: ${e.message}") }
                    }
                }
                6 -> createZip(file, parent)
                7 -> if (file.isFile && file.extension.equals("zip", true)) extractZip(file, parent) else error("Select a ZIP file to extract")
                8 -> AlertDialog.Builder(this).setTitle("Delete permanently?")
                    .setMessage("This removes the selected file or empty folder from device storage.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Delete") { _, _ ->
                        if (file.delete()) browseInternal(parent) else error("Delete denied; nonempty folders cannot be deleted here")
                    }.show()
            }
        }.show()
    }


internal fun MainActivity.showNativeDetails(file: java.io.File) {
        val kind = if (file.isDirectory) "Directory" else "File"
        val readable = file.canRead()
        val writable = file.canWrite()
        val modified = java.text.DateFormat.getDateTimeInstance().format(java.util.Date(file.lastModified()))
        AlertDialog.Builder(this).setTitle(file.name)
            .setMessage("Type: $kind\\nPath: ${file.absolutePath}\\nSize: ${formatSize(file.length())}\\nLast modified: $modified\\nReadable: $readable\\nWritable: $writable")
            .setPositiveButton("OK", null).show()
    }


internal fun MainActivity.pasteInto(destination: java.io.File) {
        val source = clipboard ?: return
        if (!source.exists()) { error("Original no longer exists"); clipboard = null; return }
        val target = java.io.File(destination, source.name)
        if (target.exists() || source.canonicalFile == target.canonicalFile ||
            (source.isDirectory && destination.canonicalFile.toPath().startsWith(source.canonicalFile.toPath()))) {
            error("Cannot paste: destination exists or is inside source"); return
        }
        AlertDialog.Builder(this).setTitle(if (cutClipboard) "Move here?" else "Copy here?")
            .setMessage("${source.name} → ${destination.absolutePath}")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Continue") { _, _ ->
                try {
                    if (cutClipboard && source.renameTo(target)) {
                        clipboard = null
                        browseInternal(destination)
                    } else {
                        copyNative(source, target)
                        if (cutClipboard) {
                            if (!source.deleteRecursively()) error("Copied, but original could not be removed. Remove it manually after checking the copy.")
                            else clipboard = null
                        }
                        browseInternal(destination)
                    }
                } catch (e: Exception) { error("Copy/move failed: ${e.message}") }
            }.show()
    }


internal fun MainActivity.copyNative(source: java.io.File, target: java.io.File) {
        if (source.isDirectory) {
            require(target.mkdir()) { "Cannot create destination directory" }
            for (child in source.listFiles() ?: throw java.io.IOException("Cannot list source directory")) {
                copyNative(child, java.io.File(target, child.name))
            }
        } else {
            require(!target.exists()) { "Destination already exists" }
            source.inputStream().use { input -> target.outputStream().use { input.copyTo(it) } }
        }
    }


internal fun MainActivity.createZip(source: java.io.File, parent: java.io.File) {
        val zipFile = java.io.File(parent, "${source.name}.zip")
        if (zipFile.exists()) { error("ZIP already exists"); return }
        AlertDialog.Builder(this).setTitle("Create ZIP?")
            .setMessage("Compress ${source.name} in this folder. Large files may take time.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Create") { _, _ ->
                try {
                    java.util.zip.ZipOutputStream(zipFile.outputStream().buffered()).use { zip ->
                        fun add(current: java.io.File, relative: String) {
                            if (current.isDirectory) {
                                val children = current.listFiles() ?: throw java.io.IOException("Cannot list ${current.name}")
                                if (children.isEmpty()) {
                                    zip.putNextEntry(java.util.zip.ZipEntry("$relative/"))
                                    zip.closeEntry()
                                }
                                for (child in children) add(child, "$relative/${child.name}")
                            } else {
                                zip.putNextEntry(java.util.zip.ZipEntry(relative))
                                current.inputStream().use { it.copyTo(zip) }
                                zip.closeEntry()
                            }
                        }
                        add(source, source.name)
                    }
                    browseInternal(parent)
                } catch (e: Exception) {
                    zipFile.delete()
                    error("ZIP creation failed: ${e.message}")
                }
            }.show()
    }


internal fun MainActivity.extractZip(file: java.io.File, parent: java.io.File) {
        val folder = java.io.File(parent, file.nameWithoutExtension)
        if (folder.exists()) { error("Extraction folder already exists"); return }
        AlertDialog.Builder(this).setTitle("Extract ZIP?")
            .setMessage("Extract to ${folder.name}/. Archive entries are checked against unsafe paths.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Extract") { _, _ ->
                Thread {
                    try {
                        require(folder.mkdir()) { "Cannot create extraction folder" }
                        val root = folder.canonicalFile.toPath()
                        var count = 0
                        var total = 0L
                        java.util.zip.ZipInputStream(file.inputStream().buffered()).use { zip ->
                            while (true) {
                                val entry = zip.nextEntry ?: break
                                count++
                                require(count <= 20_000) { "Too many ZIP entries" }
                                val out = java.io.File(folder, entry.name)
                                require(out.canonicalFile.toPath().startsWith(root)) { "Unsafe archive entry" }
                                if (entry.isDirectory) require(out.isDirectory || out.mkdirs()) { "Cannot create directory" }
                                else {
                                    require(out.parentFile?.isDirectory == true || out.parentFile?.mkdirs() == true)
                                    out.outputStream().use { stream ->
                                        val buffer = ByteArray(32_768)
                                        while (true) {
                                            val n = zip.read(buffer)
                                            if (n < 0) break
                                            total += n
                                            require(total <= 2_000_000_000L) { "ZIP exceeds 2 GB extraction safety limit" }
                                            stream.write(buffer, 0, n)
                                        }
                                    }
                                }
                                zip.closeEntry()
                            }
                        }
                        runOnUiThread { browseInternal(parent) }
                    } catch (e: Exception) {
                        folder.deleteRecursively()
                        runOnUiThread { error("ZIP extraction failed: ${e.message}") }
                    }
                }.start()
            }.show()
    }


internal fun MainActivity.manage(file: DocumentFile) {
        selected = file
        val actions = mutableListOf("Rename", "Hide / unhide", "Delete")
        if (file.isFile) { actions.add("Add encrypted copy to Vault"); actions.add("Share file") }
        AlertDialog.Builder(this).setTitle(file.name).setItems(actions.toTypedArray()) { _, which ->
            when (actions[which]) {
                "Rename" -> textDialog("New name", file.name ?: "") { rename(file, it) }
                "Hide / unhide" -> {
                    val name = file.name ?: return@setItems
                    rename(file, if (name.startsWith(".")) name.removePrefix(".") else ".$name")
                }
                "Delete" -> AlertDialog.Builder(this).setTitle("Delete file?")
                    .setMessage("This may permanently delete the selected item from device storage.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Delete") { _, _ ->
                        if (file.delete()) render() else error("Android denied deletion")
                    }.show()
                "Add encrypted copy to Vault" -> {
                    try { vault.import(file.uri, file.name ?: "file"); toast("Encrypted copy saved") }
                    catch (e: Exception) { error("Import failed: ${e.message}") }
                }
                "Share file" -> {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = file.type ?: "*/*"
                        putExtra(Intent.EXTRA_STREAM, file.uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(intent, "Share file"))
                }
            }
        }.show()
    }

internal fun MainActivity.rename(file: DocumentFile, name: String) {
        if (name.isBlank() || name.contains('/')) { error("Invalid name"); return }
        if (file.renameTo(name)) render() else error("Provider denied rename")
    }

internal fun MainActivity.textDialog(title: String, initial: String = "", onSave: (String) -> Unit) {
        val field = EditText(this).apply { setText(initial); setSingleLine() }
        AlertDialog.Builder(this).setTitle(title).setView(field)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ -> onSave(field.text.toString().trim()) }.show()
    }

internal fun MainActivity.openFile(file: DocumentFile) {
        previewBack = { render() }
        openFile(file.uri, file.name ?: "", file.type ?: "", file.length())
    }


internal fun MainActivity.openFile(uri: Uri, name: String, mime: String, length: Long) {
        layout("Preview • $name")
        button("← Back to files") { previewBack?.invoke() ?: openHome() }
        when {
            mime.startsWith("image/") -> {
                try {
                    contentResolver.openInputStream(uri).use { stream ->
                        val bitmap = BitmapFactory.decodeStream(stream)
                        requireNotNull(bitmap) { "Unsupported image format" }
                        val image = ImageView(this).apply {
                            setImageBitmap(bitmap)
                            adjustViewBounds = true
                            scaleType = ImageView.ScaleType.FIT_CENTER
                        }
                        content.addView(image, LinearLayout.LayoutParams(-1, -2))
                    }
                } catch (e: Exception) { error("Image preview failed: ${e.message}") }
            }
            mime.startsWith("video/") -> {
                val video = VideoView(this).apply {
                    setVideoURI(uri)
                    setMediaController(MediaController(this@openFile))
                    layoutParams = LinearLayout.LayoutParams(-1, 700)
                    setOnErrorListener { _, _, _ -> error("Unsupported video codec"); true }
                    start()
                }
                content.addView(video)
            }
            mime.startsWith("audio/") -> {
                button("▶ Play audio") {
                    try {
                        audio?.release()
                        audio = MediaPlayer().apply {
                            setDataSource(this@openFile, uri)
                            prepare()
                            start()
                        }
                    } catch (e: Exception) { error("Playback failed: ${e.message}") }
                }
                button("■ Stop audio") { audio?.release(); audio = null }
            }
            mime.startsWith("text/") || name.endsWith(".txt", true) ||
                name.endsWith(".md", true) || name.endsWith(".json", true) -> {
                try {
                    require(length <= 2_000_000) { "Text editor supports files up to 2 MB" }
                    val body = contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                        ?: throw IllegalStateException("File cannot be read")
                    val editor = EditText(this).apply {
                        setText(body)
                        minLines = 10
                        setTextColor(0xffeeeeee.toInt())
                    }
                    content.addView(editor)
                    button("Save changes to original file") {
                        AlertDialog.Builder(this).setTitle("Overwrite original?")
                            .setMessage("This will replace the contents of the selected file.")
                            .setNegativeButton("Cancel", null)
                            .setPositiveButton("Overwrite") { _, _ ->
                                try {
                                    contentResolver.openOutputStream(uri, "wt").use {
                                        requireNotNull(it) { "No write permission" }
                                        it.write(editor.text.toString().toByteArray(Charsets.UTF_8))
                                    }
                                    toast("Saved")
                                } catch (e: Exception) { error("Save failed: ${e.message}") }
                            }.show()
                    }
                } catch (e: Exception) { error("Text preview failed: ${e.message}") }
            }
            else -> note("This format does not have a native in-app viewer yet. No external app is launched automatically.")
        }
    }

