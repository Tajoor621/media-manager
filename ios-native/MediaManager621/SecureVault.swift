import Foundation
import CryptoKit
import LocalAuthentication
import Security

/// Encrypted copies are stored in Application Support. The symmetric key is device-only
/// Keychain material; it is never stored in UserDefaults or bundled in the application.
final class SecureVault {
    static let shared = SecureVault()
    private let service = "com.tajoor621.mediamanager.vault"
    private let account = "vault-key-v1"
    private let directory: URL

    private init() {
        directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("EncryptedVault", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    private func key() throws -> SymmetricKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data {
            return SymmetricKey(data: data)
        }
        guard status == errSecItemNotFound else { throw VaultError.keychain(status) }
        let raw = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        var insert = query
        insert.removeValue(forKey: kSecReturnData as String)
        insert.removeValue(forKey: kSecMatchLimit as String)
        insert[kSecValueData as String] = raw
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let created = SecItemAdd(insert as CFDictionary, nil)
        guard created == errSecSuccess else { throw VaultError.keychain(created) }
        return SymmetricKey(data: raw)
    }

    enum VaultError: LocalizedError {
        case keychain(OSStatus)
        case corrupted
        var errorDescription: String? {
            switch self {
            case .keychain(let code): return "Keychain error \(code)"
            case .corrupted: return "Encrypted file is damaged."
            }
        }
    }

    struct Item: Identifiable {
        let url: URL
        let name: String
        var id: String { url.path }
    }

    func list() -> [Item] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "mmvault" }
            .map { Item(url: $0, name: $0.deletingPathExtension().lastPathComponent) }
            .sorted { $0.name < $1.name }
    }

    func importCopy(_ source: URL) throws {
        let key = try key()
        let plain = try Data(contentsOf: source)
        let sealed = try AES.GCM.seal(plain, using: key)
        guard let encrypted = sealed.combined else { throw VaultError.corrupted }
        let destination = directory.appendingPathComponent(UUID().uuidString + ".mmvault")
        // Keep names encrypted too; no filename metadata outside ciphertext.
        let name = Data(source.lastPathComponent.utf8)
        var blob = Data()
        var count = UInt32(name.count).bigEndian
        withUnsafeBytes(of: &count) { blob.append(contentsOf: $0) }
        blob.append(name)
        blob.append(encrypted)
        // Encrypt the envelope so the filename is not exposed.
        let outer = try AES.GCM.seal(blob, using: key)
        guard let payload = outer.combined else { throw VaultError.corrupted }
        try payload.write(to: destination, options: [.atomic, .completeFileProtection])
    }

    func decrypt(_ item: Item) throws -> (name: String, data: Data) {
        let key = try key()
        let sealed = try AES.GCM.SealedBox(combined: Data(contentsOf: item.url))
        let blob = try AES.GCM.open(sealed, using: key)
        guard blob.count >= 5 else { throw VaultError.corrupted }
        let length = blob.prefix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
        guard length > 0, length <= 1024, blob.count > Int(length) + 4 else { throw VaultError.corrupted }
        let name = String(decoding: blob.dropFirst(4).prefix(Int(length)), as: UTF8.self)
        let inner = try AES.GCM.SealedBox(combined: Data(blob.dropFirst(Int(length) + 4)))
        return (name, try AES.GCM.open(inner, using: key))
    }

    func remove(_ item: Item) throws { try FileManager.default.removeItem(at: item.url) }

    func authenticate() async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { return false }
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock your Media Manager library and encrypted vault"
            )
        } catch { return false }
    }
}
