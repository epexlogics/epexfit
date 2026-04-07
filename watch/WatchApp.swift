// WatchApp.swift — EpexFit watchOS Companion
// SwiftUI entry point for the Apple Watch target
// See docs/APPLE_WATCH_SETUP.md for full integration guide

import SwiftUI

@main
struct EpexFitWatchApp: App {
    @StateObject private var workoutManager = WorkoutManager()
    @StateObject private var connectivityManager = ConnectivityManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workoutManager)
                .environmentObject(connectivityManager)
        }
    }
}

// ── Main View ──────────────────────────────────────────────────────────────

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @EnvironmentObject var connectivityManager: ConnectivityManager

    var body: some View {
        NavigationStack {
            if workoutManager.isSessionActive {
                ActiveWorkoutView()
            } else {
                HomeView()
            }
        }
    }
}

// ── Home View ──────────────────────────────────────────────────────────────

struct HomeView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @EnvironmentObject var connectivityManager: ConnectivityManager

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Today's stats from phone
                StatsRow(
                    steps: connectivityManager.todaySteps,
                    streak: connectivityManager.streakCount,
                    aps: connectivityManager.apsScore
                )

                // Start workout buttons
                Button(action: { workoutManager.startSession(type: .running) }) {
                    Label("Start Run", systemImage: "figure.run")
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)

                Button(action: { workoutManager.startSession(type: .cycling) }) {
                    Label("Start Ride", systemImage: "figure.outdoor.cycle")
                }
                .buttonStyle(.bordered)

                Button(action: { workoutManager.startSession(type: .traditionalStrengthTraining) }) {
                    Label("Lift", systemImage: "dumbbell")
                }
                .buttonStyle(.bordered)
            }
            .padding()
        }
        .navigationTitle("EpexFit")
    }
}

// ── Stats Row ──────────────────────────────────────────────────────────────

struct StatsRow: View {
    let steps: Int
    let streak: Int
    let aps: Double

    var body: some View {
        HStack(spacing: 8) {
            StatCell(value: "\(steps)", label: "Steps", color: .green)
            StatCell(value: "\(streak)🔥", label: "Streak", color: .orange)
            StatCell(value: String(format: "%.0f", aps), label: "APS", color: .cyan)
        }
    }
}

struct StatCell: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color.secondary.opacity(0.15))
        .cornerRadius(8)
    }
}

// ── Active Workout View ────────────────────────────────────────────────────

struct ActiveWorkoutView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    var body: some View {
        VStack(spacing: 10) {
            Text(workoutManager.elapsedTimeString)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundColor(.cyan)

            HStack(spacing: 16) {
                MetricView(value: String(format: "%.2f", workoutManager.distanceKm), label: "KM")
                MetricView(value: "\(workoutManager.heartRate)", label: "BPM")
                MetricView(value: "\(workoutManager.calories)", label: "KCAL")
            }

            Button(action: workoutManager.endSession) {
                Label("Finish", systemImage: "stop.fill")
                    .foregroundColor(.red)
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
}

struct MetricView: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .semibold))
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
    }
}
