package com.media.manager621.core.files

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class FileSafetyTest {
    @Test fun acceptsOrdinaryNames() {
        assertTrue(FileSafety.isSafeLeafName("my photo 2026.jpg"))
        assertTrue(FileSafety.isSafeLeafName(".hidden"))
    }
    @Test fun rejectsTraversalAndSeparators() {
        listOf("", ".", "..", "../secret", "dir/name", "dir\\name", "a\u0000b", "a\nb")
            .forEach { assertFalse("Should reject: $it", FileSafety.isSafeLeafName(it)) }
    }
    @Test fun protectsRootBoundary() {
        val root = File("/storage/emulated/0/Downloads")
        assertTrue(FileSafety.isInsideRoot(root, File(root, "photos/a.jpg")))
        assertFalse(FileSafety.isInsideRoot(root, File(root, "../Documents/secret.txt")))
    }
}