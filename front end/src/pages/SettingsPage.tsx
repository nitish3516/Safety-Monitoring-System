import { AppLayout } from "@/components/AppLayout";
import { API_BASE } from "@/lib/api";
import { AppSettings, loadSettings, saveSettingsLocally } from "@/lib/settings";
import { useEffect, useState } from "react";
import { User, Bell, Camera, Shield, Database, Save, Sun, Moon } from "lucide-react";
import { toast } from "sonner";

const tabs = [
  { id: "general", label: "General", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "cameras", label: "Cameras & Detection", icon: Camera },
  { id: "ppe", label: "PPE Rules", icon: Shield },
  { id: "data", label: "Data & Storage", icon: Database },
];

const unsupportedRuleKeys = new Set([
  "protectiveGloves",
  "safetyGoggles",
  "safetyBoots",
]);

function Toggle({ enabled, onToggle, disabled = false }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-12 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${enabled ? "bg-success" : "bg-muted"}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform mx-1 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [s, setS] = useState<AppSettings>(loadSettings);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) =>
    setS((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (s.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [s.theme]);

  useEffect(() => {
    const syncSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/settings`);
        if (!res.ok) return;
        const data = await res.json();
        const merged = { ...loadSettings(), ...data };
        setS(merged);
        saveSettingsLocally(merged);
      } catch {}
    };

    syncSettings();
  }, []);

  const toggleTheme = () => set("theme", s.theme === "light" ? "dark" : "light");

  const handleSave = async () => {
    setSaving(true);
    try {
      saveSettingsLocally(s);
      const res = await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });

      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Could not save settings to backend");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Settings"
      subtitle=""
      headerAction={
        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity text-sm">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      }
    >
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-52 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 whitespace-nowrap px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary font-medium border-l-0 md:border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 bg-card rounded-xl border border-border p-4 md:p-6">
          {activeTab === "general" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-6">General Settings</h2>
              <div className="space-y-5">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">System Name</label>
                  <input value={s.systemName} onChange={(e) => set("systemName", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Timezone</label>
                  <select value={s.timezone} onChange={(e) => set("timezone", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>UTC+5:30</option>
                    <option>UTC+0:00</option>
                    <option>UTC-5:00</option>
                    <option>UTC-8:00</option>
                    <option>UTC+1:00</option>
                    <option>UTC+8:00</option>
                    <option>UTC+9:00</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Language</label>
                  <select value={s.language} onChange={(e) => set("language", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Tamil</option>
                    <option>Telugu</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </div>
                <div className="border-t border-border pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Appearance</p>
                      <p className="text-sm text-muted-foreground">{s.theme === "light" ? "Light" : "Dark"} mode</p>
                    </div>
                    <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted">
                      {s.theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {s.theme === "light" ? "Light" : "Dark"}
                      <span className="text-muted-foreground">{">"}</span>
                    </button>
                  </div>
                </div>
                <div className="border-t border-border pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Haptic Feedback</p>
                      <p className="text-sm text-muted-foreground">Vibrate on alerts</p>
                    </div>
                    <Toggle enabled={s.hapticFeedback} onToggle={() => set("hapticFeedback", !s.hapticFeedback)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-6">Notification Settings</h2>
              <div className="space-y-5">
                {[
                  { label: "Email Notifications", desc: "Receive alerts via email", key: "emailNotif" },
                  { label: "Push Notifications", desc: "Browser push notifications", key: "pushNotif" },
                  { label: "SMS Alerts", desc: "Send critical alerts via SMS", key: "smsAlerts" },
                  { label: "Critical Alert Sound", desc: "Play sound for critical alerts", key: "criticalSound" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b border-border pb-5 last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Toggle enabled={s[item.key as keyof AppSettings] as boolean} onToggle={() => set(item.key as keyof AppSettings, !(s[item.key as keyof AppSettings] as boolean) as never)} />
                  </div>
                ))}
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Alert Cooldown (minutes)</label>
                  <select value={s.alertCooldown} onChange={(e) => set("alertCooldown", e.target.value)} className="w-28 px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>1</option>
                    <option>2</option>
                    <option>5</option>
                    <option>10</option>
                    <option>15</option>
                    <option>30</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Auto-acknowledge after (minutes)</label>
                  <select value={s.autoAcknowledge} onChange={(e) => set("autoAcknowledge", e.target.value)} className="w-28 px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>15</option>
                    <option>30</option>
                    <option>60</option>
                    <option>120</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "cameras" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-6">Camera & Detection Settings</h2>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-foreground">Detection Sensitivity</p>
                      <p className="text-sm text-muted-foreground">{s.sensitivity}% threshold</p>
                    </div>
                  </div>
                  <input type="range" min="0" max="100" value={s.sensitivity} onChange={(e) => set("sensitivity", Number(e.target.value))} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Sensitivity Level</label>
                  <select value={s.sensitivityLevel} onChange={(e) => set("sensitivityLevel", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>High - catch all violations</option>
                    <option>Medium - balanced</option>
                    <option>Low - reduce false positives</option>
                  </select>
                </div>
                {[
                  { label: "Record Violations", desc: "Save snapshots of detected violations", key: "recordViolations" },
                  { label: "Auto Screenshot", desc: "Capture on violation detection", key: "autoScreenshot" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b border-border pb-5 last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Toggle enabled={s[item.key as keyof AppSettings] as boolean} onToggle={() => set(item.key as keyof AppSettings, !(s[item.key as keyof AppSettings] as boolean) as never)} />
                  </div>
                ))}
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Data Retention (days)</label>
                  <select value={s.retentionDays} onChange={(e) => set("retentionDays", e.target.value)} className="w-28 px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>30</option>
                    <option>60</option>
                    <option>90</option>
                    <option>180</option>
                    <option>365</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Camera Resolution</label>
                  <select value={s.resolution} onChange={(e) => set("resolution", e.target.value)} className="w-full px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>480p</option>
                    <option>720p</option>
                    <option>1080p</option>
                    <option>1440p</option>
                    <option>4K</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ppe" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">PPE Detection Rules</h2>
              <p className="text-sm text-muted-foreground mb-6">Configure which PPE items should be monitored</p>
              <div className="space-y-5">
                {[
                  { label: "Hard Hat", desc: "Head protection in construction zones", key: "hardHat" },
                  { label: "Safety Mask", desc: "Face protection in all zones", key: "safetyMask" },
                  { label: "High-Vis Safety Vest", desc: "Visibility vest in outdoor/warehouse areas", key: "safetyVest" },
                  { label: "Protective Gloves", desc: "Hand protection for chemical handling", key: "protectiveGloves" },
                  { label: "Safety Goggles", desc: "Eye protection in welding/grinding zones", key: "safetyGoggles" },
                  { label: "Safety Boots", desc: "Foot protection in all zones", key: "safetyBoots" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b border-border pb-5 last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.desc}
                        {unsupportedRuleKeys.has(item.key) ? " Current model does not support live detection for this item." : ""}
                      </p>
                    </div>
                    <Toggle
                      enabled={s[item.key as keyof AppSettings] as boolean}
                      disabled={unsupportedRuleKeys.has(item.key)}
                      onToggle={() => set(item.key as keyof AppSettings, !(s[item.key as keyof AppSettings] as boolean) as never)}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Compliance Threshold (%)</label>
                  <select value={s.complianceThreshold} onChange={(e) => set("complianceThreshold", e.target.value)} className="w-28 px-4 py-3 rounded-xl bg-muted/50 border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base">
                    <option>70</option>
                    <option>75</option>
                    <option>80</option>
                    <option>85</option>
                    <option>90</option>
                    <option>95</option>
                    <option>100</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-6">Data & Storage</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Auto Excel Backup</p>
                  <p className="text-sm text-muted-foreground">Daily export of violation data</p>
                </div>
                <Toggle enabled={s.autoExcelBackup} onToggle={() => set("autoExcelBackup", !s.autoExcelBackup)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
