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

internal fun MainActivity.passwordInput(): EditText = EditText(this).apply {
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        transformationMethod = PasswordTransformationMethod.getInstance()
        hint = "Password (1–64 letters, numbers or symbols)"
    }


internal fun MainActivity.biometricAvailable(): Boolean =
        BiometricManager.from(this).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS


internal fun MainActivity.authenticateBiometric(onSuccess: () -> Unit) {
        if (!biometricAvailable()) {
            error("Biometric unlock is not available. Enroll a supported fingerprint or biometric in Android Settings first.")
            return
        }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess()
                }
                override fun onAuthenticationError(code: Int, message: CharSequence) {
                    toast("Biometric authentication cancelled: $message")
                }
            })
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("Media Manager security")
                .setSubtitle("Confirm your identity")
                .setNegativeButtonText("Cancel")
                .build()
        )
    }


internal fun MainActivity.showSecuritySettings() {
        if (!unlocked) { unlock(); return }
        layout("Security & app lock")
        note(if (pin.lockEnabled) "App lock: enabled" else "App lock: off (default)")
        note("App lock is optional. You can use one character or a longer password. Short passwords offer very little protection. Private Vault encryption remains separate from the app lock.")
        button(if (pin.configured) "Change app password" else "Enable password lock") {
            val first = passwordInput()
            val second = passwordInput().apply { hint = "Confirm password" }
            val fields = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(32, 8, 32, 8)
                addView(first)
                addView(second)
            }
            AlertDialog.Builder(this).setTitle("Set app password").setView(fields)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save") { _, _ ->
                    val password = first.text.toString()
                    if (password != second.text.toString()) {
                        error("Passwords do not match.")
                    } else {
                        try {
                            pin.setPin(password)
                            pin.biometricOnly = false
                            toast("Password lock enabled.")
                            showSecuritySettings()
                        } catch (e: Exception) { error(e.message ?: "Invalid password") }
                    }
                }.show()
        }
        if (biometricAvailable()) {
            button(if (pin.biometricOnly) "Biometric-only lock: enabled" else "Enable biometric-only lock") {
                authenticateBiometric {
                    pin.clearLock()
                    pin.biometricOnly = true
                    toast("Biometric-only lock enabled.")
                    showSecuritySettings()
                }
            }
        } else {
            note("Biometric-only lock is unavailable until a strong biometric is enrolled on this device.")
        }
        if (pin.lockEnabled) {
            button("Turn off app lock") {
                // Require proof of the current credential before removing an existing lock.
                if (pin.configured) {
                    val field = passwordInput()
                    AlertDialog.Builder(this).setTitle("Confirm existing password")
                        .setView(field).setNegativeButton("Cancel", null)
                        .setPositiveButton("Turn off lock") { _, _ ->
                            if (pin.verify(field.text.toString())) {
                                pin.clearLock()
                                toast("App lock disabled.")
                                showSecuritySettings()
                            } else error("Incorrect password.")
                        }.show()
                } else {
                    authenticateBiometric {
                        pin.clearLock()
                        toast("App lock disabled.")
                        showSecuritySettings()
                    }
                }
            }
            button("Lock app now") { unlocked = false; unlock() }
        }
        button("← Back to files") { openHome() }
    }


internal fun MainActivity.unlock() {
        if (!pin.lockEnabled) { unlocked = true; openHome(); return }
        unlocked = false
        layout("Media Manager is locked")
        if (pin.configured) {
            val entry = passwordInput()
            content.addView(entry)
            button("Unlock with password") {
                if (pin.verify(entry.text.toString())) {
                    unlocked = true
                    openHome()
                } else error("Incorrect password")
            }
        }
        if (biometricAvailable()) {
            button("Unlock with biometrics") {
                authenticateBiometric {
                    unlocked = true
                    openHome()
                }
            }
        } else if (pin.biometricOnly) {
            note("Your biometric lock is currently unavailable. Enroll a supported biometric in Android Settings to regain access.")
        }
    }

