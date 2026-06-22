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

export interface EnvironmentalCriteria {
  temperatureMinC: number;
  temperatureMaxC: number;
  humidityMinPercent: number;
  humidityMaxPercent: number;
  temperatureDescription: string;
  humidityDescription: string;
  environmentDescription: string;
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
  latestReadingsByDevice: DeviceLatestReadingSummary[];
  criteria: EnvironmentalCriteria;
}

export interface ReportSummary {
  totalReadings: number;
  averageTemperatureC: number | null;
  minimumTemperatureC: number | null;
  maximumTemperatureC: number | null;
  averageHumidityPercent: number | null;
  minimumHumidityPercent: number | null;
  maximumHumidityPercent: number | null;
  adequateReadings: number;
  adequatePercentage: number | null;
}

export interface ReportChartPoint {
  recordedAt: string;
  averageTemperatureC: number;
  averageHumidityPercent: number;
  readings: number;
}

export interface ReportException {
  readingId: number;
  recordedAt: string;
  temperatureC: number;
  humidityPercent: number;
  temperatureStatus: string;
  humidityStatus: string;
}

export interface EnvironmentalReport {
  generatedAt: string;
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  location: string | null;
  windowStart: string;
  windowEnd: string;
  criteria: EnvironmentalCriteria;
  summary: ReportSummary;
  chartPoints: ReportChartPoint[];
  totalExceptions: number;
  exceptionsTruncated: boolean;
  exceptions: ReportException[];
}
