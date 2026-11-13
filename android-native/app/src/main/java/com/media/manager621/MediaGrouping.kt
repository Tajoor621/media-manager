package com.media.manager621

/** Pure Kotlin: no Android dependencies, so sorting and grouping can be JVM-tested. */
internal data class MediaRow(val id: Long, val name: String, val volume: String?, val path: String?, val date: Long)
internal data class MediaFolder(val key: String, val label: String, val rows: List<MediaRow>)
internal object MediaGrouping {
    fun folderKey(volume: String?, path: String?, legacy: Boolean): String? {
        if (path == null) return null
        val normalized = path.trim().replace('\\', '/').trim('/')
        if (legacy) {
            val parent = normalized.substringBeforeLast('/', "")
            return parent.ifEmpty { "root" }
        }
        val v = volume?.takeIf { it.isNotBlank() } ?: return null
        return "$v/${normalized.substringBeforeLast('/', "").trim('/')}".trimEnd('/')
    }
    fun folderLabel(key: String): String = key.substringAfterLast('/').ifBlank { key.substringBefore('/') }
    fun group(rows: List<MediaRow>, legacy: Boolean): List<MediaFolder> =
        rows.mapNotNull { row -> folderKey(row.volume, row.path, legacy)?.let { it to row } }
            .groupBy({ it.first }, { it.second })
            .map { (key, items) ->
                MediaFolder(key, folderLabel(key), items.sortedWith(compareByDescending<MediaRow> { it.date }.thenBy { it.name.lowercase() }))
            }.sortedWith(compareBy<MediaFolder> { it.label.lowercase() }.thenBy { it.key.lowercase() })
}
