import { AppLayout } from "@/components/AppLayout";
import { fetchStatus, fetchViolations, isTodayTimestamp } from "@/lib/api";
import { Users, AlertTriangle, ShieldCheck, Video, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

type DashboardData = {
  activeWorkers: string;
  violationsToday: string;
  compliance: string;
  camerasOnline: string;
  recentViolations: Array<{ time: string; type: string; confidence: string }>;
  cameraZones: Array<{ name: string; status: string; workers: number; violations: number }>;
};

const emptyData: DashboardData = {
  activeWorkers: "-",
  violationsToday: "-",
  compliance: "-",
  camerasOnline: "-",
  recentViolations: [],
  cameraZones: [],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(emptyData);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [status, violations] = await Promise.all([fetchStatus(), fetchViolations()]);
        if (cancelled) return;

        const todaysViolations = violations.filter((entry) => isTodayTimestamp(entry.time)).length;
        const complianceValue = status.required.length
          ? Math.round(((status.required.length - status.missing.length) / status.required.length) * 100)
          : 100;

        setData({
          activeWorkers: String(status.activeWorkers ?? 0),
          violationsToday: String(todaysViolations),
          compliance: `${complianceValue}%`,
          camerasOnline: status.cameraOnline ? "1" : "0",
          recentViolations: violations
            .slice()
            .reverse()
            .slice(0, 5)
            .map((entry) => ({
              time: entry.time.split(" ")[1] ?? entry.time,
              type: entry.missing.join(", "),
              confidence: status.settings_used?.sensitivity ? `${status.settings_used.sensitivity}% threshold` : "",
            })),
          cameraZones: [
            {
              name: "Live Camera",
              status: status.cameraOnline ? "ONLINE" : "OFFLINE",
              workers: status.activeWorkers ?? 0,
              violations: status.violation ? status.missing.length : 0,
            },
          ],
        });
      } catch (error) {
        console.error(error);
      }
    };

    load();
    const timer = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const stats = [
    { label: "Active Workers", value: data.activeWorkers, icon: Users, iconColor: "text-primary" },
    { label: "Violations Today", value: data.violationsToday, icon: AlertTriangle, iconColor: "text-destructive" },
    { label: "PPE Compliance", value: data.compliance, icon: ShieldCheck, iconColor: "text-success" },
    { label: "Cameras Online", value: data.camerasOnline, icon: Video, iconColor: "text-primary" },
  ];

  return (
    <AppLayout title="Safety Dashboard" subtitle="AI-Powered PPE Monitoring System">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <p className="text-3xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-destructive" />
            Recent Violations
          </h2>
          <button onClick={() => navigate("/violations")} className="text-sm text-primary hover:underline">
            View All
          </button>
        </div>

        {data.recentViolations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No violations detected yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recentViolations.map((v, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Live Camera</p>
                    <p className="text-xs text-muted-foreground">{v.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-destructive">{v.time}</p>
                  <p className="text-xs text-muted-foreground">{v.confidence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Camera Zones
          </h2>
          <button onClick={() => navigate("/camera-zones")} className="text-sm text-primary hover:underline">
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.cameraZones.map((zone, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-foreground text-sm">{zone.name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${zone.status === "ONLINE" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {zone.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {zone.workers} workers &nbsp; {zone.violations} violations
              </p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
