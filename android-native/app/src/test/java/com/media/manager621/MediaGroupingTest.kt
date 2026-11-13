package com.media.manager621

import org.junit.Assert.*
import org.junit.Test

class MediaGroupingTest {
    @Test fun rootAndNestedPaths() {
        assertEquals("external_primary", MediaGrouping.folderKey("external_primary", "a.jpg", false))
        assertEquals("external_primary/DCIM/Camera", MediaGrouping.folderKey("external_primary", "DCIM/Camera/a.jpg", false))
        assertEquals("external_primary", MediaGrouping.folderLabel("external_primary"))
    }
    @Test fun legacyPathUsesParent() {
        assertEquals("storage/emulated/0/DCIM", MediaGrouping.folderKey(null, "/storage/emulated/0/DCIM/a.jpg", true))
    }
    @Test fun sortingAndNullRows() {
        val rows = listOf(MediaRow(1,"z.jpg","external","Photos/z.jpg",1), MediaRow(2,"a.jpg","external","Photos/a.jpg",5),
            MediaRow(3,"orphan","external",null,9), MediaRow(4,"B.jpg","external","other/B.jpg",3))
        val grouped = MediaGrouping.group(rows, false)
        assertEquals(2, grouped.size)
        assertEquals("other", grouped[0].label)
        assertEquals(listOf(2L,1L), grouped[1].rows.map { it.id })
    }
    @Test fun emptyNameIsAllowedAsMetadata() {
        assertEquals(1, MediaGrouping.group(listOf(MediaRow(1,"","external","a/",1)), false).size)
    }
}
