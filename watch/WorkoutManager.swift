// WorkoutManager.swift — HealthKit workout session for watchOS
import Foundation
import HealthKit
import Combine

enum WatchWorkoutType {
    case running, cycling, traditionalStrengthTraining, walking, other
    var hkType: HKWorkoutActivityType {
        switch self {
        case .running:   return .running
        case .cycling:   return .cycling
        case .walking:   return .walking
        case .traditionalStrengthTraining: return .traditionalStrengthTraining
        case .other:     return .other
        }
    }
}

@MainActor
class WorkoutManager: NSObject, ObservableObject {
    // MARK: - Published state
    @Published var isSessionActive = false
    @Published var heartRate: Int = 0
    @Published var distanceKm: Double = 0
    @Published var calories: Int = 0
    @Published var elapsedSeconds: Int = 0

    var elapsedTimeString: String {
        let m = elapsedSeconds / 60, s = elapsedSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }

    // MARK: - Private
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var timer: AnyCancellable?
    private var startDate: Date?

    // MARK: - Permissions
    func requestPermissions() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let types: Set<HKSampleType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.activeEnergyBurned),
        ]
        try? await healthStore.requestAuthorization(toShare: types, read: types)
    }

    // MARK: - Session lifecycle
    func startSession(type: WatchWorkoutType) {
        let config = HKWorkoutConfiguration()
        config.activityType = type.hkType
        config.locationType = type == .traditionalStrengthTraining ? .indoor : .outdoor

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            session?.delegate = self
            builder?.delegate = self
            startDate = Date()
            session?.startActivity(with: startDate!)
            builder?.beginCollection(withStart: startDate!) { _, _ in }
            isSessionActive = true
            startTimer()
        } catch {
            print("[WorkoutManager] Failed to start session: \(error)")
        }
    }

    func endSession() {
        session?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { workout, _ in
                DispatchQueue.main.async {
                    self?.isSessionActive = false
                    self?.stopTimer()
                    if let workout {
                        ConnectivityManager.shared.sendWorkoutToPhone(workout)
                    }
                }
            }
        }
    }

    // MARK: - Timer
    private func startTimer() {
        timer = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.elapsedSeconds += 1 }
    }
    private func stopTimer() { timer?.cancel(); timer = nil }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ session: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    nonisolated func workoutSession(_ session: HKWorkoutSession, didFailWithError error: Error) {
        print("[WorkoutManager] Session error: \(error)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ builder: HKLiveWorkoutBuilder) {}
    nonisolated func workoutBuilder(_ builder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            let stats = builder.statistics(for: quantityType)
            DispatchQueue.main.async {
                switch quantityType {
                case HKQuantityType(.heartRate):
                    self.heartRate = Int(stats?.mostRecentQuantity()?.doubleValue(for: .count().unitDivided(by: .minute())) ?? 0)
                case HKQuantityType(.distanceWalkingRunning):
                    self.distanceKm = (stats?.sumQuantity()?.doubleValue(for: .meter()) ?? 0) / 1000
                case HKQuantityType(.activeEnergyBurned):
                    self.calories = Int(stats?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0)
                default: break
                }
            }
        }
    }
}
