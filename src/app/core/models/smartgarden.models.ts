export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface Reading {
  id: number;
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  temperatureC: number;
  humidityPercent: number;
  recordedAt: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingHistory {
  deviceCode: string;
  deviceName: string;
  windowStart: string;
  windowEnd: string;
  totalPoints: number;
  readings: Reading[];
}

export interface Device {
  id: number;
  deviceCode: string;
  name: string;
  location: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
}

export interface DeviceLatestReadingSummary {
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  location: string | null;
  active: boolean;
  lastSeenAt: string | null;
  latestReading: Reading;
}

export interface DashboardSummary {
  generatedAt: string;
  windowStart: string;
  windowHours: number;
  totalDevices: number;
  activeDevices: number;
  totalReadings: number;
  readingsInWindow: number;
  averageTemperatureCInWindow: number | null;
  averageHumidityPercentInWindow: number | null;
  activeAlertCount: number;
  alerts: DashboardAlert[];
  latestReadingsByDevice: DeviceLatestReadingSummary[];
}

export interface DashboardAlert {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  deviceCode: string;
  deviceName: string;
}
