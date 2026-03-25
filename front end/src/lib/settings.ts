export const STORAGE_KEY = "ppe_settings";
export const SETTINGS_UPDATED_EVENT = "ppe-settings-updated";

export type AppSettings = {
  systemName: string;
  timezone: string;
  language: string;
  hapticFeedback: boolean;
  theme: "light" | "dark";
  emailNotif: boolean;
  pushNotif: boolean;
  smsAlerts: boolean;
  criticalSound: boolean;
  alertCooldown: string;
  autoAcknowledge: string;
  sensitivity: number;
  sensitivityLevel: string;
  recordViolations: boolean;
  autoCapture: boolean;
  autoScreenshot: boolean;
  retentionDays: string;
  resolution: string;
  hardHat: boolean;
  safetyMask: boolean;
  safetyVest: boolean;
  protectiveGloves: boolean;
  safetyGoggles: boolean;
  safetyBoots: boolean;
  complianceThreshold: string;
  autoExcelBackup: boolean;
};

export function getDefaultSettings(): AppSettings {
  return {
    systemName: "AI Workplace Safety Monitor",
    timezone: "UTC+5:30",
    language: "English",
    hapticFeedback: true,
    theme: "light",
    emailNotif: true,
    pushNotif: true,
    smsAlerts: false,
    criticalSound: true,
    alertCooldown: "5",
    autoAcknowledge: "30",
    sensitivity: 75,
    sensitivityLevel: "High - catch all violations",
    recordViolations: true,
    autoCapture: true,
    autoScreenshot: true,
    retentionDays: "90",
    resolution: "1080p",
    hardHat: true,
    safetyMask: true,
    safetyVest: true,
    protectiveGloves: true,
    safetyGoggles: true,
    safetyBoots: true,
    complianceThreshold: "90",
    autoExcelBackup: false,
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...getDefaultSettings(), ...JSON.parse(raw) };
  } catch {}
  return getDefaultSettings();
}

export function saveSettingsLocally(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
}
