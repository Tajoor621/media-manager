package com.media.manager621

import android.content.Context
import android.net.Uri
import android.util.Log
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

/**
 * Encrypts private COPIES of imported files; originals are untouched.
 * The AES key is non-exportable and stored in Android Keystore.
 */
class Vault(private val context: Context) {
    private val root = File(context.filesDir, "vault").apply { mkdirs() }
    private val alias = "mm621-vault-v1"

    private fun key(): java.security.Key {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        ks.getKey(alias, null)?.let { Log.d("MM621", "Existing vault key available"); return it }
        Log.d("MM621", "Generating device-protected vault encryption key")
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey().also { Log.d("MM621", "Vault encryption key generated") }
    }

    fun import(uri: Uri, originalName: String): String {
        val safeName = originalName.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(90)
        val file = File(root, "${System.currentTimeMillis()}_${java.util.UUID.randomUUID()}_${safeName}.vault")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        try {
            context.contentResolver.openInputStream(uri).use { input ->
                requireNotNull(input) { "Cannot read selected file" }
                file.outputStream().use { output ->
                    // Header: magic (4 bytes), nonce length (1 byte), nonce, ciphertext and GCM tag.
                    output.write(byteArrayOf(0x4d, 0x4d, 0x36, 0x31))
                    output.write(cipher.iv.size)
                    output.write(cipher.iv)
                    javax.crypto.CipherOutputStream(output, cipher).use { encrypted ->
                        input.copyTo(encrypted)
                    }
                }
            }
        } catch (error: Exception) {
            file.delete()
            throw error
        }
        return file.name
    }

    fun list(): List<String> = root.listFiles()
        ?.filter { it.isFile && it.name.endsWith(".vault") }
        ?.sortedByDescending { it.lastModified() }
        ?.map { it.name } ?: emptyList()

    fun decryptToMemory(name: String, maxBytes: Int = 12 * 1024 * 1024): ByteArray {
        require(!name.contains('/') && !name.contains('\\')) { "Invalid vault entry" }
        val file = File(root, name)
        require(file.canonicalFile.parentFile == root.canonicalFile) { "Invalid path" }
        require(file.length() <= maxBytes + 1024) { "File too large for memory preview" }
        return file.inputStream().use { input ->
            val header = ByteArray(4)
            require(input.read(header) == 4 && header.contentEquals(byteArrayOf(0x4d, 0x4d, 0x36, 0x31))) {
                "Invalid vault format"
            }
            val n = input.read()
            require(n in 12..16) { "Invalid nonce" }
            val iv = ByteArray(n)
            require(input.read(iv) == n) { "Truncated vault file" }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            javax.crypto.CipherInputStream(input, cipher).use { encrypted ->
                encrypted.readBytes().also { require(it.size <= maxBytes) { "Preview too large" } }
            }
        }
    }

    fun delete(name: String): Boolean {
        require(!name.contains('/') && !name.contains('\\') && name.endsWith(".vault"))
        val file = File(root, name)
        require(file.canonicalFile.parentFile == root.canonicalFile)
        return file.delete()
    }
}
