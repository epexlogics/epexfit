// ConnectivityManager.swift — WCSession sync between Watch and iPhone
import Foundation
import WatchConnectivity
import HealthKit

class ConnectivityManager: NSObject, ObservableObject {
    static let shared = ConnectivityManager()

    @Published var todaySteps: Int = 0
    @Published var streakCount: Int = 0
    @Published var apsScore: Double = 0

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Send workout summary to phone
    func sendWorkoutToPhone(_ workout: HKWorkout) {
        guard WCSession.default.isReachable else {
            // Queue for background transfer
            let payload: [String: Any] = [
                "type": "workout_completed",
                "duration": workout.duration,
                "distance": workout.totalDistance?.doubleValue(for: .meter()) ?? 0,
                "calories": workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0,
                "startedAt": workout.startDate.timeIntervalSince1970,
            ]
            WCSession.default.transferUserInfo(payload)
            return
        }

        WCSession.default.sendMessage(
            ["type": "workout_completed", "duration": workout.duration],
            replyHandler: nil,
            errorHandler: { err in print("[WCSession] Send error: \(err)") }
        )
    }
}

// MARK: - WCSessionDelegate
extension ConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    // Receive stats from iPhone
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            if let steps = message["todaySteps"] as? Int { self.todaySteps = steps }
            if let streak = message["streakCount"] as? Int { self.streakCount = streak }
            if let aps = message["apsScore"] as? Double { self.apsScore = aps }
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        session(session, didReceiveMessage: userInfo)
    }
}
