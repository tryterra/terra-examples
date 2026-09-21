// Terra Grip — watchOS companion app.
//
// Connects to the paired iPhone over WatchConnectivity and streams the
// watch's heart rate + steps to it; the phone relays the stream to Terra.
// Generated into the iOS build as the TerraGripWatch target at prebuild
// (see docs/WATCHOS-SETUP.md).

import SwiftUI
import TerraRTiOS

@main
struct TerraGripWatchApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var terra: Terra?
    @State private var streaming = false
    @State private var status = "Not connected"

    var body: some View {
        VStack(spacing: 12) {
            Text("Terra Grip")
                .font(.headline)
            Text(status)
                .font(.footnote)
                .foregroundColor(.gray)

            Button(streaming ? "Stop" : "Start streaming") {
                streaming ? stop() : start()
            }
            .tint(streaming ? .red : .green)
        }
        .onAppear(perform: connect)
    }

    private func connect() {
        do {
            terra = try Terra()
            terra?.connect()
            status = "Connected to phone"
        } catch {
            status = "Init failed: \(error.localizedDescription)"
        }
    }

    private func start() {
        // startExercise gives full-frequency capture; startStream works
        // outside a workout session at reduced frequency.
        terra?.startExercise(forType: .RUNNING) { success, error in
            DispatchQueue.main.async {
                if success {
                    streaming = true
                    status = "Streaming (workout session)"
                } else {
                    status = "Failed: \(error?.localizedDescription ?? "unknown")"
                }
            }
        }
    }

    private func stop() {
        terra?.stopExercise { _, _ in
            DispatchQueue.main.async {
                streaming = false
                status = "Connected to phone"
            }
        }
    }
}
