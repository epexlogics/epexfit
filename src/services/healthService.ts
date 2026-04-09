/**
 * healthService.ts
 *
 * Real HealthKit (iOS) / Google Fit (Android) integration via expo-sensors Pedometer.
 *
 * FIX #18: Now explicitly calls Pedometer.requestPermissionsAsync() before any
 * step-count operation. On iOS, calling the pedometer without CMMotionActivity
 * permission granted returns 0 steps silently — the permission request ensures
 * the OS prompt appears and the user can grant access.
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
  private _permissionGranted: boolean | null = null;

  /** Request motion/activity permission, then check hardware availability. */
  async requestAndCheckPermission(): Promise<boolean> {
    try {
      // Request permission first — iOS shows the NSMotionUsageDescription prompt here
      const { status } = await Pedometer.requestPermissionsAsync();
      this._permissionGranted = status === 'granted';
      if (!this._permissionGranted) return false;

      const available = await Pedometer.isAvailableAsync();
      return available;
    } catch {
      return false;
    }
  }

  /** Check whether HealthKit / Google Fit is available (no permission request). */
  async isAvailable(): Promise<boolean> {
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  }

  /**
   * Pull today's step count from HealthKit / Google Fit.
   * Requests permission first, falls back to cache on denial or offline.
   */
  async getTodaySteps(): Promise<HealthSyncResult> {
    try {
      const available = await this.requestAndCheckPermission();
      if (!available) {
        const cached = await this._getCachedSteps();
        return { steps: cached, available: false, source: cached > 0 ? 'cached' : 'none' };
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();

      const result = await Pedometer.getStepCountAsync(start, end);
      const steps = result?.steps ?? 0;

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ steps, date: new Date().toISOString() }));

      return { steps, available: true, source: this._detectPlatformSource() };
    } catch {
      const cached = await this._getCachedSteps();
      return { steps: cached, available: false, source: 'cached' };
    }
  }

  /**
   * Start a live step-count subscription for the active workout.
   * Requests permission before subscribing.
   */
  async startLiveTracking(onUpdate: (steps: number) => void): Promise<boolean> {
    this.stopLiveTracking();

    const granted = await this.requestAndCheckPermission();
    if (!granted) return false;

    this._liveSteps = 0;

    this._subscription = Pedometer.watchStepCount((result) => {
      this._liveSteps = result.steps;
      onUpdate(this._liveSteps);
    });

    return true;
  }

  stopLiveTracking(): void {
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }
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
      const cacheDate = new Date(parsed.date).toDateString();
      const today = new Date().toDateString();
      return cacheDate === today ? (parsed.steps ?? 0) : 0;
    } catch {
      return 0;
    }
  }
}

export const healthService = new HealthService();
