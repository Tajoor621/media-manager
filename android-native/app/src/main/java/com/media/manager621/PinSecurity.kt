package com.media.manager621

import android.content.Context
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import android.util.Base64

/** Local PIN gate; it does not encrypt the vault key. */
class PinSecurity(context: Context) {
    private val prefs = context.getSharedPreferences("mm621-lock", Context.MODE_PRIVATE)
    private val random = SecureRandom()
    val configured: Boolean get() = prefs.contains("hash")
    var biometricOnly: Boolean
        get() = prefs.getBoolean("biometric_only", false)
        set(value) { prefs.edit().putBoolean("biometric_only", value).apply() }
    val lockEnabled: Boolean get() = configured || biometricOnly
    private fun derive(pin: CharArray, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(pin, salt, 210_000, 256)
        return try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded }
        finally { spec.clearPassword() }
    }
    fun setPin(pin: String) {
        require(pin.length in 1..64) { "Use 1–64 characters" }
        val salt = ByteArray(32).also { random.nextBytes(it) }
        val hash = derive(pin.toCharArray(), salt)
        prefs.edit()
            .putString("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
            .putString("hash", Base64.encodeToString(hash, Base64.NO_WRAP))
            .apply()
    }
    fun clearLock() {
        prefs.edit().remove("hash").remove("salt").putBoolean("biometric_only", false).apply()
    }
    fun verify(pin: String): Boolean {
        if (!configured) return false
        return try {
            val salt = Base64.decode(prefs.getString("salt", ""), Base64.NO_WRAP)
            val expected = Base64.decode(prefs.getString("hash", ""), Base64.NO_WRAP)
            MessageDigest.isEqual(expected, derive(pin.toCharArray(), salt))
        } catch (_: Exception) { false }
    }
}
