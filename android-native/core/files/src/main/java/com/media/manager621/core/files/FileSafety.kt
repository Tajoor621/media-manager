package com.media.manager621.core.files

/** Reject ambiguous or unsafe leaf names before asking a storage provider to create files. */
object FileSafety {
    fun isSafeLeafName(name: String): Boolean =
        name.isNotBlank() && name != "." && name != ".." &&
            !name.contains('/') && !name.contains('\\') &&
            !name.contains('\u0000') && !name.contains(':') &&
            name.length <= 255 && name.none { it.code < 32 }

    fun requireSafeLeafName(name: String): String {
        require(isSafeLeafName(name)) { "Invalid file name" }
        return name
    }

    /** Protects internal-storage operations from escaping an approved root. */
    fun isInsideRoot(root: java.io.File, candidate: java.io.File): Boolean {
        val base = root.canonicalFile.toPath()
        return candidate.canonicalFile.toPath().startsWith(base)
    }
}