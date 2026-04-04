import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { notificationService, SmartNotifParams } from '../services/notifications';

interface NotificationContextType {
  notificationPermission: boolean;
  scheduleReminders: (settings: Record<string, any>) => Promise<void>;
  sendLocalNotification: (title: string, body: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  sendSmartNotifications: (params: SmartNotifParams) => Promise<void>;
  notifyBadgeUnlocked: (label: string, icon: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notificationPermission, setNotificationPermission] = useState(false);

  useEffect(() => {
    checkPermissions();
    const subs = [
      Notifications.addNotificationReceivedListener(() => {}),
      Notifications.addNotificationResponseReceivedListener(() => {}),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationPermission(status === 'granted');
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F5C842',
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === 'granted';
    setNotificationPermission(granted);
    if (!granted) {
      Alert.alert(
        'Notifications Off',
        'Enable notifications in Settings to get streak alerts and progress updates.',
        [{ text: 'OK' }]
      );
    }
    return granted;
  };

  const sendLocalNotification = async (title: string, body: string) => {
    if (!notificationPermission) {
      const ok = await requestPermissions();
      if (!ok) return;
    }
    await notificationService.sendImmediate(title, body);
  };

  const scheduleReminders = async (settings: Record<string, any>) => {
    if (!notificationPermission) {
      const ok = await requestPermissions();
      if (!ok) return;
    }
    await notificationService.scheduleReminders(settings as any);
  };

  const cancelAllNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  // Upgraded smart notifications with full strategy
  const sendSmartNotifications = async (params: SmartNotifParams) => {
    await notificationService.evaluateAndSend(params);
  };

  const notifyBadgeUnlocked = async (label: string, icon: string) => {
    await notificationService.notifyBadgeUnlocked(label, icon);
  };

  return (
    <NotificationContext.Provider value={{
      notificationPermission,
      scheduleReminders,
      sendLocalNotification,
      cancelAllNotifications,
      sendSmartNotifications,
      notifyBadgeUnlocked,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
