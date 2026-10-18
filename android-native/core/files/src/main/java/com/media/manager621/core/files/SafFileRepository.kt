package com.media.manager621.core.files

import android.content.ContentResolver
import android.net.Uri
import androidx.documentfile.provider.DocumentFile

/**
 * Provider-backed operations: no MANAGE_EXTERNAL_STORAGE permission required.
 * Calls may block and must be invoked on a worker thread for large operations.
 */
class SafFileRepository(private val resolver: ContentResolver) {
    fun children(folder: DocumentFile): List<DocumentFile> =
        folder.listFiles().sortedWith(
            compareByDescending<DocumentFile> { it.isDirectory }
                .thenBy { it.name?.lowercase() ?: "" }
        )

    fun createDirectory(parent: DocumentFile, name: String): DocumentFile {
        FileSafety.requireSafeLeafName(name)
        require(parent.findFile(name) == null) { "Name already exists" }
        return requireNotNull(parent.createDirectory(name)) { "Folder creation denied" }
    }

    fun createFile(parent: DocumentFile, mime: String, name: String): DocumentFile {
        FileSafety.requireSafeLeafName(name)
        require(parent.findFile(name) == null) { "Name already exists" }
        return requireNotNull(parent.createFile(mime, name)) { "File creation denied" }
    }

    fun rename(file: DocumentFile, name: String): Boolean {
        FileSafety.requireSafeLeafName(name)
        return file.renameTo(name)
    }

    fun delete(file: DocumentFile): Boolean = file.delete()

    fun copyFile(source: Uri, target: Uri): Long {
        val input = requireNotNull(resolver.openInputStream(source)) { "Source unreadable" }
        val output = requireNotNull(resolver.openOutputStream(target, "w")) { "Target unwritable" }
        return input.use { from -> output.use { to -> from.copyTo(to).toLong() } }
    }
}