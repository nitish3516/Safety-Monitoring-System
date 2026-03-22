export type DetectionBox = {
  id: string;
  label: string;
  confidence: number;
  found: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DetectionStatus = {
  lastUpdated: string | null;
  detected: string[];
  detections: DetectionBox[];
  missing: string[];
  required: string[];
  violation: boolean;
  activeWorkers: number;
  cameraOnline: boolean;
  image: string | null;
  settings_used: {
    sensitivity: number;
    sensitivityLevel: string;
    recordViolations: boolean;
  };
  unsupported_rules?: string[];
};

export type ViolationEntry = {
  id: string;
  time: string;
  missing: string[];
  image: string | null;
  detected?: string[];
  required?: string[];
};

const API_BASE = "http://127.0.0.1:5000";

export async function fetchStatus(): Promise<DetectionStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function fetchViolations(): Promise<ViolationEntry[]> {
  const res = await fetch(`${API_BASE}/violations`);
  if (!res.ok) throw new Error("Failed to fetch violations");
  return res.json();
}

export async function deleteViolation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/violations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete violation");
}

export function violationCounts(violations: ViolationEntry[]) {
  return violations.reduce<Record<string, number>>((acc, entry) => {
    for (const item of entry.missing) {
      acc[item] = (acc[item] ?? 0) + 1;
    }
    return acc;
  }, {});
}

export function isTodayTimestamp(value: string) {
  const today = new Date();
  const date = new Date(value.replace(" ", "T"));
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
