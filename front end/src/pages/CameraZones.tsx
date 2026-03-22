import { AppLayout } from "@/components/AppLayout";
import { fetchStatus, fetchViolations, isTodayTimestamp } from "@/lib/api";
import { MapPin, Wifi, WifiOff, Users, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

type Zone = {
  name: string;
  status: "ONLINE" | "OFFLINE";
  workers: number;
  violations: number;
};

export default function CameraZones() {
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [status, violations] = await Promise.all([fetchStatus(), fetchViolations()]);
        if (cancelled) return;

        setZones([
          {
            name: "Live Camera",
            status: status.cameraOnline ? "ONLINE" : "OFFLINE",
            workers: status.activeWorkers ?? 0,
            violations: violations.filter((item) => isTodayTimestamp(item.time)).length,
          },
        ]);
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

  return (
    <AppLayout title="Camera Zones" subtitle={`${zones.length} monitoring zones configured`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((z) => (
          <div key={z.name} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${z.status === "ONLINE" ? "bg-success/10" : "bg-muted"}`}>
                <MapPin className={`h-5 w-5 ${z.status === "ONLINE" ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{z.name}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${z.status === "ONLINE" ? "text-success" : "text-muted-foreground"}`}>
                  {z.status === "ONLINE" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {z.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {z.workers} workers
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className={`h-4 w-4 ${z.violations > 0 ? "text-destructive" : ""}`} />
                {z.violations} violations
              </span>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
