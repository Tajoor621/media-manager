package com.media.manager621

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeDetailsMessageTest {
    @Test fun detailsUseRealNewlines() {
        val message = nativeDetailsMessage(
            kind = "File",
            path = "/storage/emulated/0/example.txt",
            size = "12 B",
            modified = "today",
            readable = true,
            writable = false,
        )
        assertTrue(message.contains("\n"))
        assertFalse(message.contains("\\n"))
    }
}
