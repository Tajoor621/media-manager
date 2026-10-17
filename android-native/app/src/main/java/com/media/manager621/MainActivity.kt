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

/**
 * Native-first Android file manager alpha. SAF grants are persisted by the OS.
 * Protected Android folders are deliberately not bypassed.
 */
class MainActivity : FragmentActivity() {
    private lateinit var vault: Vault
    private lateinit var pin: PinSecurity
    private lateinit var rootLayout: LinearLayout
    private lateinit var content: LinearLayout
    private var currentFolder: DocumentFile? = null
    private var selected: DocumentFile? = null
    private var unlocked = false
    private var backgroundAt = 0L
    private var audio: MediaPlayer? = null
    private var awaitingAllFilesPermission = false
    private var showHidden = true
    private var sortBySize = false
    private var query = ""
    private var clipboard: java.io.File? = null
    private var cutClipboard = false

    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            try {
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
                getSharedPreferences("mm621-folders", MODE_PRIVATE).edit()
                    .putString("last", uri.toString()).apply()
                currentFolder = DocumentFile.fromTreeUri(this, uri)
                render()
            } catch (e: Exception) { error("Folder access denied: ${e.message}") }
        }
    }
    private val vaultPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null && unlocked) {
            try {
                val name = DocumentFile.fromSingleUri(this, uri)?.name ?: "imported"
                vault.import(uri, name)
                toast("Encrypted copy added to Private Vault. Original remains unchanged.")
                showVault()
            } catch (e: Exception) { error("Vault import failed: ${e.message}") }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vault = Vault(this)
        pin = PinSecurity(this)
        window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE,
            android.view.WindowManager.LayoutParams.FLAG_SECURE)
        if (!pin.configured) setupPin() else unlock()
    }
    override fun onStop() {
        super.onStop()
        backgroundAt = System.currentTimeMillis()
        audio?.release()
        audio = null
    }
    override fun onResume() {
        super.onResume()
        if (pin.configured && unlocked && backgroundAt > 0 &&
            System.currentTimeMillis() - backgroundAt > 30_000L) {
            awaitingAllFilesPermission = false
            unlocked = false
            unlock()
            return
        }
        if (awaitingAllFilesPermission) {
            awaitingAllFilesPermission = false
            if (unlocked && hasAllFilesAccess()) {
                browseInternal(Environment.getExternalStorageDirectory())
                return
            }
            if (unlocked) toast("Storage access not granted. You can still select individual folders.")
        }
    }

    private fun layout(title: String) {
        rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xff101014.toInt())
            setPadding(18, 24, 18, 16)
        }
        val header = TextView(this).apply {
            text = title
            textSize = 23f
            setTextColor(0xffd8b46b.toInt())
            setPadding(0, 0, 0, 12)
        }
        rootLayout.addView(header)
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content)
        rootLayout.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(rootLayout)
    }
    private fun button(label: String, action: () -> Unit) {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }
        content.addView(b, LinearLayout.LayoutParams(-1, -2))
    }
    private fun note(text: String) {
        content.addView(TextView(this).apply {
            this.text = text
            textSize = 14f
            setTextColor(0xffded9cc.toInt())
            setPadding(4, 10, 4, 10)
        })
    }
    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
    private fun error(text: String) = AlertDialog.Builder(this).setTitle("Media Manager")
        .setMessage(text).setPositiveButton("OK", null).show()

    private fun pinInput(): EditText = EditText(this).apply {
        inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
        hint = "6–64 digit PIN"
    }
    private fun setupPin() {
        layout("Set up Media Manager security")
        note("Create a local PIN to lock the app and Private Vault. Losing the PIN can make your data inaccessible. This PIN does not encrypt the vault key.")
        val first = pinInput()
        val second = pinInput().apply { hint = "Confirm PIN" }
        content.addView(first)
        content.addView(second)
        button("Create PIN and continue") {
            val a = first.text.toString()
            if (a != second.text.toString()) { error("PINs do not match"); return@button }
            try {
                pin.setPin(a)
                unlocked = true
                openHome()
            } catch (e: Exception) { error(e.message ?: "Invalid PIN") }
        }
    }
    private fun unlock() {
        layout("Media Manager is locked")
        val entry = pinInput()
        content.addView(entry)
        button("Unlock with PIN") {
            if (pin.verify(entry.text.toString())) {
                unlocked = true
                openHome()
            } else error("Incorrect PIN")
        }
        val supported = BiometricManager.from(this).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS
        if (supported) button("Unlock with fingerprint / biometrics") {
            val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        unlocked = true
                        openHome()
                    }
                    override fun onAuthenticationError(code: Int, message: CharSequence) {
                        toast("Biometric unlock cancelled: $message")
                    }
                })
            prompt.authenticate(
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Unlock Media Manager")
                    .setSubtitle("Confirm your identity to open the app")
                    .setNegativeButtonText("Use PIN")
                    .build()
            )
        }
    }
    private fun hasAllFilesAccess(): Boolean =
        Build.VERSION.SDK_INT >= 30 && Environment.isExternalStorageManager()

    private fun openHome() {
        if (!unlocked) { unlock(); return }
        if (hasAllFilesAccess()) browseInternal(Environment.getExternalStorageDirectory()) else render()
    }

    private fun render() {
        if (!unlocked) { unlock(); return }
        layout("Media Manager 621 • Native")
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
        button("Private Vault") { showVault() }
        button("Lock now") { unlocked = false; unlock() }
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

    private fun formatSize(bytes: Long): String = when {
        bytes >= 1_073_741_824 -> "%.1f GB".format(bytes.toDouble() / 1_073_741_824)
        bytes >= 1_048_576 -> "%.1f MB".format(bytes.toDouble() / 1_048_576)
        else -> "$bytes B"
    }

    private fun browseInternal(directory: java.io.File) {
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
    }

    private fun previewNativeFile(file: java.io.File) {
        // FileProvider creates a temporary content URI for our own viewer.
        val uri = androidx.core.content.FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        val mime = android.webkit.MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(file.extension.lowercase()) ?: "application/octet-stream"
        openFile(uri, file.name, mime, file.length())
    }

    private fun showInstalledApps() {
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

    private fun manageInternal(file: java.io.File, parent: java.io.File) {
        val options = arrayOf("Details", "Rename", "Hide / unhide", "Copy to another folder", "Move to another folder", "Copy into this folder", "Create ZIP", "Delete")
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
                7 -> AlertDialog.Builder(this).setTitle("Delete permanently?")
                    .setMessage("This removes the selected file or empty folder from device storage.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Delete") { _, _ ->
                        if (file.delete()) browseInternal(parent) else error("Delete denied; nonempty folders cannot be deleted here")
                    }.show()
            }
        }.show()
    }

    private fun showNativeDetails(file: java.io.File) {
        val kind = if (file.isDirectory) "Directory" else "File"
        val readable = file.canRead()
        val writable = file.canWrite()
        val modified = java.text.DateFormat.getDateTimeInstance().format(java.util.Date(file.lastModified()))
        AlertDialog.Builder(this).setTitle(file.name)
            .setMessage("Type: $kind\\nPath: ${file.absolutePath}\\nSize: ${formatSize(file.length())}\\nLast modified: $modified\\nReadable: $readable\\nWritable: $writable")
            .setPositiveButton("OK", null).show()
    }

    private fun pasteInto(destination: java.io.File) {
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

    private fun copyNative(source: java.io.File, target: java.io.File) {
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

    private fun createZip(source: java.io.File, parent: java.io.File) {
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

    private fun requestAllFilesAccess() {
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

    private fun manage(file: DocumentFile) {
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
    private fun rename(file: DocumentFile, name: String) {
        if (name.isBlank() || name.contains('/')) { error("Invalid name"); return }
        if (file.renameTo(name)) render() else error("Provider denied rename")
    }
    private fun textDialog(title: String, initial: String = "", onSave: (String) -> Unit) {
        val field = EditText(this).apply { setText(initial); setSingleLine() }
        AlertDialog.Builder(this).setTitle(title).setView(field)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ -> onSave(field.text.toString().trim()) }.show()
    }
    private fun openFile(file: DocumentFile) =
        openFile(file.uri, file.name ?: "", file.type ?: "", file.length())

    private fun openFile(uri: Uri, name: String, mime: String, length: Long) {
        layout("Preview • $name")
        button("← Back to files") { render() }
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
                    setMediaController(MediaController(this@MainActivity))
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
                            setDataSource(this@MainActivity, uri)
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

    private fun showVault() {
        if (!unlocked) { unlock(); return }
        layout("Private Vault • encrypted")
        note("Vault entries are AES-256-GCM encrypted private copies. Originals remain on device. Hide/unhide is NOT encryption.")
        button("← Back to file manager") { render() }
        button("Import file into encrypted Vault") { vaultPicker.launch(arrayOf("*/*")) }
        for (name in vault.list()) {
            button("🔒 ${name.removeSuffix(".vault")}") {
                AlertDialog.Builder(this).setTitle("Private encrypted file")
                    .setItems(arrayOf("Show text preview (small UTF-8 files)", "Delete encrypted copy")) { _, which ->
                        if (which == 0) {
                            try {
                                val text = vault.decryptToMemory(name).toString(Charsets.UTF_8)
                                AlertDialog.Builder(this).setTitle("Decrypted text preview")
                                    .setMessage(text.take(12_000)).setPositiveButton("Close", null).show()
                            } catch (e: Exception) { error("Cannot preview: ${e.message}") }
                        } else {
                            AlertDialog.Builder(this).setTitle("Delete encrypted copy?")
                                .setNegativeButton("Cancel", null)
                                .setPositiveButton("Delete") { _, _ ->
                                    if (vault.delete(name)) showVault() else error("Delete failed")
                                }.show()
                        }
                    }.show()
            }
        }
    }
}
