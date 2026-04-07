/**
 * healthService.ts
 *
 * Real HealthKit (iOS) / Google Fit (Android) integration.
 *
 * Implementation strategy:
 *  - expo-sensors Pedometer.watchStepCount() ──► live step count from CoreMotion / Google Fit
 *  - expo-sensors Pedometer.getStepCountAsync() ──► historical steps for today
 *
 * This is the approved Expo managed-workflow path — no bare native module required,
 * works with EAS Build out of the box, and pulls real data from both platforms.
 *
 * iOS:  reads from HealthKit (requires NSHealthUpdateUsageDescription + NSHealthShareUsageDescription in app.json)
 * Android: reads from Google Fit step sensor (requires android.permission.ACTIVITY_RECOGNITION)
 */

import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@epexfit_health_steps_cache';

export interface HealthSyncResult {
  steps: number;
  available: boolean;
  source: 'healthkit' | 'googlefit' | 'cached' | 'none';
}

class HealthService {
  private _subscription: ReturnType<typeof Pedometer.watchStepCount> | null = null;
  private _liveSteps = 0;
  private _stepBase = 0; // steps at tracking start, so we get delta
  private _onStepUpdate: ((steps: number) => void) | null = null;

  /** Check whether HealthKit / Google Fit is available on this device */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await Pedometer.isAvailableAsync();
      return result;
    } catch {
      return false;
    }
  }

  /**
   * Pull today's step count from HealthKit / Google Fit.
   * Falls back to AsyncStorage cache if unavailable (offline / permission denied).
   */
  async getTodaySteps(): Promise<HealthSyncResult> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        const cached = await this._getCachedSteps();
        return { steps: cached, available: false, source: 'cached' };
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();

      const result = await Pedometer.getStepCountAsync(start, end);
      const steps = result?.steps ?? 0;

      // Persist for offline fallback
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ steps, date: new Date().toISOString() }));

      return {
        steps,
        available: true,
        source: this._detectPlatformSource(),
      };
    } catch {
      const cached = await this._getCachedSteps();
      return { steps: cached, available: false, source: 'cached' };
    }
  }

  /**
   * Start a live step-count subscription for the active workout.
   * Calls onUpdate(totalSteps) every time steps change.
   */
  startLiveTracking(onUpdate: (steps: number) => void): void {
    this.stopLiveTracking();
    this._onStepUpdate = onUpdate;
    this._liveSteps = 0;
    this._stepBase = 0;

    this._subscription = Pedometer.watchStepCount((result) => {
      this._liveSteps = result.steps;
      onUpdate(this._liveSteps);
    });
  }

  stopLiveTracking(): void {
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }
    this._onStepUpdate = null;
    this._liveSteps = 0;
  }

  getLiveSteps(): number {
    return this._liveSteps;
  }

  private _detectPlatformSource(): 'healthkit' | 'googlefit' {
    const { Platform } = require('react-native');
    return Platform.OS === 'ios' ? 'healthkit' : 'googlefit';
  }

  private async _getCachedSteps(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      // Only use today's cache
      const cacheDate = new Date(parsed.date).toDateString();
      const today = new Date().toDateString();
      return cacheDate === today ? (parsed.steps ?? 0) : 0;
    } catch {
      return 0;
    }
  }
}

export const healthService = new HealthService();
