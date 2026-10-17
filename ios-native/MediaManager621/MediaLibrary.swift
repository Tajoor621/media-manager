import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct LibraryEntry: Identifiable, Hashable {
    let url: URL
    var id: String { url.path }
    var name: String { url.lastPathComponent }
    var isFolder: Bool { (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false }
    var bytes: Int64 { Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    var modified: Date? { try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate }
}

@MainActor
final class MediaLibrary: ObservableObject {
    @Published var folder: URL
    @Published var entries: [LibraryEntry] = []
    @Published var errorMessage: String?
    @Published var showHidden = false
    @Published var search = ""
    @Published var sortBySize = false
    @Published var favorites: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "favorites") ?? [])

    let root: URL

    init() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        root = documents.appendingPathComponent("My Library", isDirectory: true)
        folder = root
        do {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        } catch {
            errorMessage = error.localizedDescription
        }
        refresh()
    }

    var visibleEntries: [LibraryEntry] {
        let filtered = entries.filter { entry in
            (showHidden || !entry.name.hasPrefix(".")) &&
            (search.isEmpty || entry.name.localizedCaseInsensitiveContains(search))
        }
        return filtered.sorted {
            if $0.isFolder != $1.isFolder { return $0.isFolder }
            if sortBySize && $0.bytes != $1.bytes { return $0.bytes > $1.bytes }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    func refresh() {
        do {
            let urls = try FileManager.default.contentsOfDirectory(
                at: folder, includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
                options: []
            )
            entries = urls.map { LibraryEntry(url: $0) }
        } catch {
            entries = []
            errorMessage = error.localizedDescription
        }
    }

    func enter(_ url: URL) {
        guard url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path + "/"),
              (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        else { return }
        folder = url
        refresh()
    }

    func goUp() {
        guard folder.standardizedFileURL != root.standardizedFileURL else { return }
        folder = folder.deletingLastPathComponent()
        refresh()
    }

    func importFile(_ external: URL) {
        let granted = external.startAccessingSecurityScopedResource()
        defer { if granted { external.stopAccessingSecurityScopedResource() } }
        do {
            let target = uniqueURL(for: external.lastPathComponent, in: folder)
            try FileManager.default.copyItem(at: external, to: target)
            refresh()
        } catch { errorMessage = "Import failed: \(error.localizedDescription)" }
    }

    func importData(_ data: Data, name: String) {
        do {
            try data.write(to: uniqueURL(for: name, in: folder), options: .atomic)
            refresh()
        } catch { errorMessage = "Import failed: \(error.localizedDescription)" }
    }

    func createFolder(_ name: String) {
        guard valid(name) else { errorMessage = "Enter a valid folder name."; return }
        do {
            try FileManager.default.createDirectory(
                at: folder.appendingPathComponent(name, isDirectory: true), withIntermediateDirectories: false)
            refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func rename(_ entry: LibraryEntry, to name: String) {
        guard valid(name) else { errorMessage = "Enter a valid name."; return }
        do {
            let destination = entry.url.deletingLastPathComponent().appendingPathComponent(name)
            guard !FileManager.default.fileExists(atPath: destination.path) else {
                errorMessage = "A file with that name already exists."; return
            }
            try FileManager.default.moveItem(at: entry.url, to: destination)
            refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func delete(_ entry: LibraryEntry) {
        do {
            try FileManager.default.removeItem(at: entry.url)
            favorites.remove(entry.id)
            saveFavorites()
            refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func toggleFavorite(_ entry: LibraryEntry) {
        if favorites.contains(entry.id) { favorites.remove(entry.id) }
        else { favorites.insert(entry.id) }
        saveFavorites()
    }

    func toggleHidden(_ entry: LibraryEntry) {
        let name = entry.name.hasPrefix(".") ? String(entry.name.dropFirst()) : "." + entry.name
        rename(entry, to: name)
    }

    func uniqueURL(for name: String, in folder: URL) -> URL {
        let original = folder.appendingPathComponent(name)
        if !FileManager.default.fileExists(atPath: original.path) { return original }
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var index = 2
        while true {
            let candidate = folder.appendingPathComponent("\(base) (\(index))" + (ext.isEmpty ? "" : ".\(ext)"))
            if !FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            index += 1
        }
    }

    private func valid(_ name: String) -> Bool {
        !name.isEmpty && name != "." && name != ".." && !name.contains("/") && !name.contains("\u{0000}")
    }

    private func saveFavorites() {
        UserDefaults.standard.set(Array(favorites), forKey: "favorites")
    }
}
