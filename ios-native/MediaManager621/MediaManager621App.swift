import SwiftUI

@main
struct MediaManager621App: App {
    @StateObject private var library = MediaLibrary()

    var body: some Scene {
        WindowGroup {
            LibraryView()
                .environmentObject(library)
                .tint(Color(red: 0.85, green: 0.70, blue: 0.42))
                .preferredColorScheme(.dark)
        }
    }
}
