import SwiftUI
import PhotosUI
import QuickLook
import AVKit
import UniformTypeIdentifiers

struct LibraryView: View {
    @EnvironmentObject private var library: MediaLibrary
    @Environment(\.scenePhase) private var scenePhase
    @State private var unlocked = false
    @State private var unlockError = ""
    @State private var importer = false
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var newFolder = false
    @State private var folderName = ""
    @State private var renameEntry: LibraryEntry?
    @State private var renameText = ""
    @State private var deleteEntry: LibraryEntry?
    @State private var preview: URL?
    @State private var vaultOpen = false
    @State private var vaultItems: [SecureVault.Item] = []
    @State private var vaultDelete: SecureVault.Item?
    @State private var vaultError = ""
    @State private var vaultExport: URL?
    @State private var lastExportTemp: URL?
    @State private var player: AVPlayer?
    @State private var showPlayer = false
    @State private var textEntry: LibraryEntry?
    @State private var textValue = ""

    private let gold = Color(red: 0.85, green: 0.70, blue: 0.42)

    var body: some View {
        NavigationStack {
            Group {
                if unlocked {
                    libraryContent
                } else {
                    lockedView
                }
            }
            .background(Color(red: 0.055, green: 0.055, blue: 0.07))
            .navigationTitle(unlocked ? "Media Manager 621" : "Media Manager")
            .toolbar {
                if unlocked {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button("New folder", systemImage: "folder.badge.plus") { newFolder = true }
                            Button("Import files", systemImage: "square.and.arrow.down") { importer = true }
                            Button("Show hidden files", systemImage: library.showHidden ? "eye" : "eye.slash") {
                                library.showHidden.toggle()
                            }
                            Button("Sort by \(library.sortBySize ? "name" : "size")", systemImage: "arrow.up.arrow.down") {
                                library.sortBySize.toggle()
                            }
                            Button("Lock app", systemImage: "lock") { lock() }
                        } label: {
                            Image(systemName: "ellipsis.circle").font(.title3)
                        }
                    }
                }
            }
        }
        .task { await authenticate() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { lock() }
        }
        .fileImporter(isPresented: $importer, allowedContentTypes: [.item], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls): urls.forEach(library.importFile)
            case .failure(let error): library.errorMessage = error.localizedDescription
            }
        }
        .onChange(of: selectedPhotos) { _, items in
            Task {
                for (index, item) in items.enumerated() {
                    do {
                        if let data = try await item.loadTransferable(type: Data.self) {
                            let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
                            library.importData(data, name: "Photo-\(Int(Date().timeIntervalSince1970))-\(index).\(ext)")
                        }
                    } catch { library.errorMessage = error.localizedDescription }
                }
                selectedPhotos = []
            }
        }
        .quickLookPreview($preview)
        .alert("New folder", isPresented: $newFolder) {
            TextField("Folder name", text: $folderName)
            Button("Create") { library.createFolder(folderName); folderName = "" }
            Button("Cancel", role: .cancel) { folderName = "" }
        }
        .alert("Rename", isPresented: Binding(
            get: { renameEntry != nil },
            set: { if !$0 { renameEntry = nil } }
        )) {
            TextField("New name", text: $renameText)
            Button("Save") {
                if let entry = renameEntry { library.rename(entry, to: renameText) }
                renameEntry = nil
            }
            Button("Cancel", role: .cancel) { renameEntry = nil }
        }
        .confirmationDialog("Delete this item permanently?", isPresented: Binding(
            get: { deleteEntry != nil },
            set: { if !$0 { deleteEntry = nil } }
        ), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let entry = deleteEntry { library.delete(entry) }
                deleteEntry = nil
            }
        }
        .alert("Media Manager", isPresented: Binding(
            get: { library.errorMessage != nil },
            set: { if !$0 { library.errorMessage = nil } }
        )) {
            Button("OK") { library.errorMessage = nil }
        } message: { Text(library.errorMessage ?? "") }
        .sheet(isPresented: $vaultOpen) { vaultView }
        .sheet(isPresented: $showPlayer, onDismiss: { player?.pause(); player = nil }) {
            if let player {
                VideoPlayer(player: player)
                    .background(.black)
                    .onAppear { player.play() }
            }
        }
        .sheet(item: $textEntry) { entry in textEditor(entry) }
    }

    private var lockedView: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "externaldrive.fill.badge.person.crop")
                .font(.system(size: 68)).foregroundStyle(gold)
            Text("Your private media library")
                .font(.title2.bold())
            Text("Use Face ID, Touch ID or your iPhone passcode to unlock.")
                .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            if !unlockError.isEmpty {
                Text(unlockError).font(.caption).foregroundStyle(.orange)
            }
            Button("Unlock Media Manager") { Task { await authenticate() } }
                .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(24)
    }

    private var libraryContent: some View {
        VStack(spacing: 0) {
            HStack {
                if library.folder != library.root {
                    Button { library.goUp() } label: { Label("Back", systemImage: "chevron.left") }
                }
                Spacer()
                Text(library.folder == library.root ? "My Library" : library.folder.lastPathComponent)
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
                Button { vaultItems = SecureVault.shared.list(); vaultOpen = true } label: {
                    Label("Vault", systemImage: "lock.shield")
                }
            }
            .padding(.horizontal).padding(.vertical, 10)

            HStack(spacing: 10) {
                Button { importer = true } label: {
                    Label("Files", systemImage: "doc.badge.plus")
                }
                .buttonStyle(.bordered)
                PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 30, matching: .any(of: [.images, .videos])) {
                    Label("Photos", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(.bordered)
                Button { newFolder = true } label: {
                    Label("Folder", systemImage: "folder.badge.plus")
                }
                .buttonStyle(.bordered)
            }
            .font(.caption)
            .padding(.horizontal)

            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search this folder", text: $library.search)
                    .textInputAutocapitalization(.never)
            }
            .padding(12)
            .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal).padding(.top, 12)

            List {
                if library.visibleEntries.isEmpty {
                    ContentUnavailableView("No files here", systemImage: "folder",
                        description: Text("Import files or photos to start building your private library."))
                        .listRowBackground(Color.clear)
                }
                ForEach(library.visibleEntries) { entry in
                    HStack(spacing: 12) {
                        Image(systemName: entry.isFolder ? "folder.fill" : icon(for: entry))
                            .font(.title3)
                            .foregroundStyle(entry.isFolder ? gold : .white)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.name).lineLimit(1)
                            Text(entry.isFolder ? "Folder" : ByteCountFormatter.string(fromByteCount: entry.bytes, countStyle: .file))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if library.favorites.contains(entry.id) {
                            Image(systemName: "star.fill").foregroundStyle(gold)
                        }
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { open(entry) }
                    .contextMenu {
                        Button("Details", systemImage: "info.circle") {
                            library.errorMessage = "\(entry.name)\n\(entry.url.path)\n\(entry.bytes) bytes"
                        }
                        Button("Rename", systemImage: "pencil") {
                            renameEntry = entry; renameText = entry.name
                        }
                        Button(entry.name.hasPrefix(".") ? "Unhide" : "Hide", systemImage: "eye.slash") {
                            library.toggleHidden(entry)
                        }
                        Button(library.favorites.contains(entry.id) ? "Remove favorite" : "Favorite",
                               systemImage: "star") { library.toggleFavorite(entry) }
                        if !entry.isFolder {
                            ShareLink(item: entry.url) { Label("Share / Export", systemImage: "square.and.arrow.up") }
                            Button("Add encrypted copy to Vault", systemImage: "lock.shield") {
                                do {
                                    try SecureVault.shared.importCopy(entry.url)
                                    library.errorMessage = "Encrypted copy saved. The original is unchanged."
                                } catch { library.errorMessage = error.localizedDescription }
                            }
                        }
                        Button("Delete", systemImage: "trash", role: .destructive) { deleteEntry = entry }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .refreshable { library.refresh() }
        }
    }

    private func icon(for entry: LibraryEntry) -> String {
        let ext = entry.url.pathExtension.lowercased()
        if ["jpg", "jpeg", "png", "heic", "gif", "webp"].contains(ext) { return "photo" }
        if ["mp4", "mov", "m4v"].contains(ext) { return "film" }
        if ["mp3", "m4a", "wav", "aac", "flac"].contains(ext) { return "music.note" }
        if ext == "pdf" { return "doc.richtext" }
        return "doc"
    }

    private func open(_ entry: LibraryEntry) {
        if entry.isFolder { library.enter(entry.url); return }
        let ext = entry.url.pathExtension.lowercased()
        if ["mp4", "mov", "m4v", "mp3", "m4a", "wav", "aac"].contains(ext) {
            player = AVPlayer(url: entry.url)
            showPlayer = true
        } else if ["txt", "md", "json", "csv", "log"].contains(ext) && entry.bytes < 2_000_000 {
            do {
                textValue = try String(contentsOf: entry.url, encoding: .utf8)
                textEntry = entry
            } catch { library.errorMessage = error.localizedDescription }
        } else {
            preview = entry.url
        }
    }

    private func textEditor(_ entry: LibraryEntry) -> some View {
        NavigationStack {
            TextEditor(text: $textValue)
                .font(.system(.body, design: .monospaced))
                .padding(10)
                .navigationTitle(entry.name)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { textEntry = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            do {
                                try textValue.write(to: entry.url, atomically: true, encoding: .utf8)
                                library.refresh()
                                textEntry = nil
                            } catch { library.errorMessage = error.localizedDescription }
                        }
                    }
                }
        }
    }

    private var vaultView: some View {
        NavigationStack {
            List {
                Section {
                    Text("Encrypted copies remain in this app's private storage. Original files are not removed. If the app or its key is deleted, encrypted data may be unrecoverable.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                ForEach(vaultItems) { item in
                    HStack {
                        Label("Encrypted item", systemImage: "lock.doc")
                        Spacer()
                        Button("Export") {
                            do {
                                let decrypted = try SecureVault.shared.decrypt(item)
                                let safeName = URL(fileURLWithPath: decrypted.name).lastPathComponent
                                let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + safeName)
                                try decrypted.data.write(to: tmp, options: [.atomic, .completeFileProtection])
                                lastExportTemp = tmp
                                vaultExport = tmp
                            } catch { vaultError = error.localizedDescription }
                        }
                        .buttonStyle(.bordered)
                        Button(role: .destructive) { vaultDelete = item } label: {
                            Image(systemName: "trash")
                        }
                    }
                }
            }
            .navigationTitle("Private Vault")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { vaultOpen = false } } }
            .alert("Delete encrypted copy?", isPresented: Binding(
                get: { vaultDelete != nil }, set: { if !$0 { vaultDelete = nil } }
            )) {
                Button("Delete", role: .destructive) {
                    if let item = vaultDelete {
                        do { try SecureVault.shared.remove(item); vaultItems = SecureVault.shared.list() }
                        catch { vaultError = error.localizedDescription }
                    }
                    vaultDelete = nil
                }
                Button("Cancel", role: .cancel) { vaultDelete = nil }
            }
            .alert("Vault error", isPresented: Binding(
                get: { !vaultError.isEmpty }, set: { if !$0 { vaultError = "" } }
            )) {
                Button("OK") { vaultError = "" }
            } message: { Text(vaultError) }
            .sheet(item: Binding(
                get: { vaultExport.map { TemporaryExport(url: $0) } },
                set: { if $0 == nil { vaultExport = nil } }
            ), onDismiss: {
                if let url = lastExportTemp { try? FileManager.default.removeItem(at: url) }
                lastExportTemp = nil
                vaultExport = nil
            }) { export in
                ShareSheet(items: [export.url])
            }
        }
    }

    private func authenticate() async {
        unlocked = await SecureVault.shared.authenticate()
        if !unlocked { unlockError = "Set up a device passcode or biometric unlock in iOS Settings." }
    }

    private func lock() {
        unlocked = false
        vaultOpen = false
        preview = nil
        player?.pause()
        player = nil
        showPlayer = false
        if let url = lastExportTemp { try? FileManager.default.removeItem(at: url) }
        lastExportTemp = nil
        vaultExport = nil
    }
}

private struct TemporaryExport: Identifiable {
    let url: URL
    var id: String { url.path }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
