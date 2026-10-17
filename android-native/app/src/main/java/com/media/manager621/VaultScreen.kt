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

internal fun MainActivity.showVault() {
        if (!unlocked) { unlock(); return }
        layout("Private Vault • encrypted")
        note("Vault entries are AES-256-GCM encrypted private copies. Originals remain on device. Hide/unhide is NOT encryption.")
        button("← Back to file manager") { openHome() }
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