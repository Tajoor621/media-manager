package com.media.manager621

import android.Manifest
import android.app.AlertDialog
import android.content.ContentUris
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.MediaStore
import android.util.LruCache
import android.util.Size
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.core.content.ContextCompat

internal enum class MediaKind { PHOTOS, VIDEOS, MUSIC }
internal data class LibraryItem(val id: Long, val name: String, val uri: android.net.Uri, val mime: String, val date: Long, val folderKey: String)
internal class MediaThumbs(private val activity: MainActivity) {
    private val maxKb = (Runtime.getRuntime().maxMemory() / 1024 / 32).toInt().coerceAtLeast(1024)
    private val cache = object : LruCache<String, Bitmap>(maxKb) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount / 1024
    }
    fun get(item: LibraryItem, kind: MediaKind): Bitmap? {
        if (kind == MediaKind.MUSIC) return null
        val key = item.uri.toString()
        cache.get(key)?.let { return it }
        val image = try {
            if (Build.VERSION.SDK_INT >= 29) activity.contentResolver.loadThumbnail(item.uri, Size(112,112), null)
            else if (kind == MediaKind.PHOTOS) MediaStore.Images.Thumbnails.getThumbnail(
                activity.contentResolver, item.id, MediaStore.Images.Thumbnails.MINI_KIND, null)
            else MediaStore.Video.Thumbnails.getThumbnail(
                activity.contentResolver, item.id, MediaStore.Video.Thumbnails.MINI_KIND, null)
        } catch (_: Exception) { null }
        if (image != null) cache.put(key, image)
        return image
    }
}

internal fun MainActivity.mediaPermissionGranted(kind: MediaKind): Boolean {
    val required = if (Build.VERSION.SDK_INT >= 33) when(kind) {
        MediaKind.PHOTOS -> Manifest.permission.READ_MEDIA_IMAGES
        MediaKind.VIDEOS -> Manifest.permission.READ_MEDIA_VIDEO
        MediaKind.MUSIC -> Manifest.permission.READ_MEDIA_AUDIO
    } else Manifest.permission.READ_EXTERNAL_STORAGE
    return ContextCompat.checkSelfPermission(this, required) == PackageManager.PERMISSION_GRANTED ||
        (Build.VERSION.SDK_INT >= 34 && kind != MediaKind.MUSIC &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED)
}


internal fun MainActivity.requestMediaAccess(kind: MediaKind) {
    if (!unlocked) { unlock(); return }
    requestedMediaKind = kind
    val permission = if (Build.VERSION.SDK_INT >= 33) when (kind) {
        MediaKind.PHOTOS -> Manifest.permission.READ_MEDIA_IMAGES
        MediaKind.VIDEOS -> Manifest.permission.READ_MEDIA_VIDEO
        MediaKind.MUSIC -> Manifest.permission.READ_MEDIA_AUDIO
    } else Manifest.permission.READ_EXTERNAL_STORAGE
    val permissions = if (Build.VERSION.SDK_INT >= 34 && kind != MediaKind.MUSIC)
        arrayOf(permission, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
    else arrayOf(permission)
    val prefs = getSharedPreferences("mm621-settings", android.content.Context.MODE_PRIVATE)
    val asked = prefs.getBoolean("media-requested-${kind.name}", false)
    if (asked && !shouldShowRequestPermissionRationale(permission)) {
        showMediaPermissionDialog(kind, true)
    } else {
        prefs.edit().putBoolean("media-requested-${kind.name}", true).apply()
        mediaPermissionRequest.launch(permissions)
    }
}

internal fun MainActivity.showMediaPermissionDialog(kind: MediaKind, permanent: Boolean = false) {
    if (!unlocked) { unlock(); return }
    val partial = Build.VERSION.SDK_INT >= 34 && kind != MediaKind.MUSIC &&
        ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED
    val message = when {
        partial -> "Only selected photos or videos are accessible. You can change your selection in Android Settings."
        permanent -> "Media access is disabled. Open app permissions in Android Settings to grant access."
        else -> "Media access was not granted. You can continue using the SAF file picker instead."
    }
    AlertDialog.Builder(this).setTitle("Media library access").setMessage(message)
        .setPositiveButton(if (permanent) "Open app permissions" else "Try again") { _, _ ->
            if (permanent) {
                val i = android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.parse("package:$packageName"))
                startActivity(i)
            } else requestMediaAccess(kind)
        }
        .setNegativeButton("Use folder picker") { _, _ -> folderPicker.launch(null) }
        .show()
}

internal fun MainActivity.showMediaHome() {
    if (!unlocked) { unlock(); return }
    layout("Media library")
    note("Browse Photos, Videos and Music stored on this device. Access is optional; SAF file browsing remains available without it.")
    button("Photos") { showMediaFolders(MediaKind.PHOTOS) }
    button("Videos") { showMediaFolders(MediaKind.VIDEOS) }
    button("Music") { showMediaFolders(MediaKind.MUSIC) }
    button("Open SAF folder") { folderPicker.launch(null) }
    if (hasAllFilesAccess()) button("Internal storage explorer") { browseInternal(android.os.Environment.getExternalStorageDirectory()) }
    button("Security & app lock") { showSecuritySettings() }
    button("File explorer setup") { render() }
}

internal fun MainActivity.showMediaFolders(kind: MediaKind) {
    if (!unlocked) { unlock(); return }
    if (!mediaPermissionGranted(kind)) {
        requestMediaAccess(kind)
        return
    }
    layout("${kind.name.lowercase().replaceFirstChar { it.uppercase() }} • folders")
    button("← Media library") { showMediaHome() }
    note("Loading media folders…")
    val generation = listingGeneration
    listingExecutor.execute {
        val items = try { queryMedia(kind) } catch (e: Exception) {
            android.util.Log.e("MM621", "Media query failed", e)
            runOnUiThread { if (generation == listingGeneration && !isFinishing) error("Cannot read media library: ${e.message}") }
            emptyList()
        }
        val grouped = items.groupBy { it.folderKey }.toSortedMap(String.CASE_INSENSITIVE_ORDER)
        runOnUiThread {
            if (generation != listingGeneration || isFinishing || isDestroyed) return@runOnUiThread
            if (content.childCount > 0) content.removeViewAt(content.childCount - 1)
            if (grouped.isEmpty()) note("No media folders found in the currently granted library.")
            grouped.forEach { (key, rows) ->
                button("${MediaGrouping.folderLabel(key)} (${rows.size})") { showMediaFolder(kind, key, rows) }
            }
        }
    }
}

internal fun MainActivity.queryMedia(kind: MediaKind): List<LibraryItem> {
    val collection = when(kind) {
        MediaKind.PHOTOS -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        MediaKind.VIDEOS -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        MediaKind.MUSIC -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    }
    val columns = arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
        MediaStore.MediaColumns.MIME_TYPE, MediaStore.MediaColumns.DATE_ADDED,
        if (Build.VERSION.SDK_INT >= 29) MediaStore.MediaColumns.RELATIVE_PATH else MediaStore.MediaColumns.DATA,
        if (Build.VERSION.SDK_INT >= 29) MediaStore.MediaColumns.VOLUME_NAME else MediaStore.MediaColumns.DATA)
    val items = mutableListOf<LibraryItem>()
    contentResolver.query(collection, columns, null, null, "${MediaStore.MediaColumns.DATE_ADDED} DESC")?.use { cursor ->
        val idIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
        val nameIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
        val mimeIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
        val dateIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
        val pathIdx = cursor.getColumnIndexOrThrow(columns[4])
        val volumeIdx = cursor.getColumnIndexOrThrow(columns[5])
        while(cursor.moveToNext()) {
            if (cursor.isNull(pathIdx)) continue
            val path = cursor.getString(pathIdx)
            val volume = if (Build.VERSION.SDK_INT >= 29 && !cursor.isNull(volumeIdx)) cursor.getString(volumeIdx) else null
            val folderKey = if (Build.VERSION.SDK_INT >= 29) {
                val v = volume?.takeIf { it.isNotBlank() } ?: continue
                "$v/${path.trim('/')}".trimEnd('/')
            } else {
                MediaGrouping.folderKey(null, path, true) ?: continue
            }
            val id = cursor.getLong(idIdx)
            items += LibraryItem(id, cursor.getString(nameIdx) ?: "Untitled", ContentUris.withAppendedId(collection,id),
                cursor.getString(mimeIdx) ?: "application/octet-stream", cursor.getLong(dateIdx), folderKey)
        }
    }
    return items
}

internal fun MainActivity.showMediaFolder(kind: MediaKind, folder: String, rows: List<LibraryItem>, shown: Int = 300) {
    if (!unlocked) { unlock(); return }
    layout(MediaGrouping.folderLabel(folder))
    button("← Media folders") { showMediaFolders(kind) }
    note("${rows.size} files • displaying ${minOf(shown,rows.size)}")
    val thumbnails = mediaThumbs
    rows.take(shown).forEach { item ->
        val line = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val thumbnail = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(76,76)
            scaleType = ImageView.ScaleType.CENTER_CROP
            contentDescription = item.name
        }
        line.addView(thumbnail)
        val open = android.widget.Button(this).apply {
            text = item.name
            isAllCaps = false
            setOnClickListener {
                previewBack = { showMediaFolder(kind, folder, rows, shown) }
                openFile(item.uri, item.name, item.mime, -1L)
            }
        }
        line.addView(open, LinearLayout.LayoutParams(0, -2, 1f))
        content.addView(line)
        // Cache thumbnails; paging limits the number of views in this legacy ScrollView.
        if (kind != MediaKind.MUSIC) {
            val observer = object : android.view.View.OnAttachStateChangeListener {
                override fun onViewAttachedToWindow(v: android.view.View) {
                    listingExecutor.execute {
                        val bmp = thumbnails.get(item, kind)
                        runOnUiThread { if (v.isAttachedToWindow && bmp != null) thumbnail.setImageBitmap(bmp) }
                    }
                }
                override fun onViewDetachedFromWindow(v: android.view.View) = Unit
            }
            line.addOnAttachStateChangeListener(observer)
        }
    }
    if (shown < rows.size) button("Load 300 more") { showMediaFolder(kind, folder, rows, shown + 300) }
}
