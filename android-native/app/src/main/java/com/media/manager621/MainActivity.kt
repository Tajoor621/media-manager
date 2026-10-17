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

/**
 * Native-first Android file manager alpha. SAF grants are persisted by the OS.
 * Protected Android folders are deliberately not bypassed.
 */
class MainActivity : FragmentActivity() {
    internal lateinit var vault: Vault
    internal lateinit var pin: PinSecurity
    internal lateinit var rootLayout: LinearLayout
    internal lateinit var content: LinearLayout
    internal var currentFolder: DocumentFile? = null
    internal var selected: DocumentFile? = null
    internal var unlocked = false
    internal var backgroundAt = 0L
    internal var audio: MediaPlayer? = null
    internal var awaitingAllFilesPermission = false
    internal var showHidden = true
    internal var sortBySize = false
    internal var query = ""
    internal var clipboard: java.io.File? = null
    internal var cutClipboard = false
    internal var previewBack: (() -> Unit)? = null
    internal val listingExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    internal var listingGeneration = 0

    internal val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            try {
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
                getSharedPreferences("mm621-folders", MODE_PRIVATE).edit()
                    .putString("last", uri.toString()).apply()
                currentFolder = DocumentFile.fromTreeUri(this, uri)
                android.util.Log.d("MM621", "SAF folder permission granted")
                render()
            } catch (e: Exception) { android.util.Log.e("MM621", "SAF permission failed", e); error("Folder access denied: ${e.message}") }
        }
    }
    internal val vaultPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
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
        try {
            vault = Vault(this)
            pin = PinSecurity(this)
            window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE,
                android.view.WindowManager.LayoutParams.FLAG_SECURE)
            android.util.Log.d("MM621", "Activity created; optional lock enabled: ${pin.lockEnabled}")
            if (pin.lockEnabled) unlock() else { unlocked = true; openHome() }
        } catch (failure: Exception) {
            android.util.Log.e("MM621", "Startup failed", failure)
            showStartupError(failure)
        }
    }
    private fun showStartupError(failure: Exception) {
        try {
            layout("Media Manager • recovery")
            note("Media Manager could not finish starting. Restart the app or reinstall the latest native APK. Your files have not been modified by this error.")
            button("Try again") { recreate() }
            AlertDialog.Builder(this).setTitle("Unable to open Media Manager")
                .setMessage(failure.localizedMessage ?: "An unexpected startup error occurred.")
                .setPositiveButton("Retry") { _, _ -> recreate() }
                .setNegativeButton("Close") { _, _ -> finish() }
                .show()
        } catch (secondary: Exception) {
            android.util.Log.e("MM621", "Recovery UI failed", secondary)
            Toast.makeText(applicationContext, "Media Manager could not start. Please reinstall the native APK.", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onDestroy() {
        listingExecutor.shutdownNow()
        super.onDestroy()
    }

    override fun onStop() {
        super.onStop()
        backgroundAt = System.currentTimeMillis()
        audio?.release()
        audio = null
    }
    override fun onResume() {
        super.onResume()
        if (!::pin.isInitialized) return
        if (pin.lockEnabled && unlocked && backgroundAt > 0 &&
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

    internal fun layout(title: String) {
        listingGeneration++
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
    internal fun button(label: String, action: () -> Unit) {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }
        content.addView(b, LinearLayout.LayoutParams(-1, -2))
    }
    internal fun note(text: String) {
        content.addView(TextView(this).apply {
            this.text = text
            textSize = 14f
            setTextColor(0xffded9cc.toInt())
            setPadding(4, 10, 4, 10)
        })
    }
    internal fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
    internal fun error(text: String) = AlertDialog.Builder(this).setTitle("Media Manager")
        .setMessage(text).setPositiveButton("OK", null).show()

    internal fun openHome() {
        if (!unlocked) { unlock(); return }
        if (hasAllFilesAccess()) browseInternal(Environment.getExternalStorageDirectory()) else render()
    }


}
