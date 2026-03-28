import { AppLayout } from "@/components/AppLayout";
import { fetchStatus, fetchViolations } from "@/lib/api";
import { User } from "lucide-react";
import { useEffect, useState } from "react";

type WorkerCard = {
  id: string;
  name: string;
  compliance: number;
  issues: string[];
};

function formatIssueLabel(issue: string) {
  if (issue === "Hardhat") return "No Hard Hat";
  if (issue === "Mask") return "No Mask";
  if (issue === "Safety Vest") return "No Vest";
  return `No ${issue}`;
}

function getBarColor(score: number) {
  if (score >= 90) return "bg-success";
  if (score >= 75) return "bg-warning";
  return "bg-destructive";
}

export default function Workers() {
  const [workers, setWorkers] = useState<WorkerCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [status, violations] = await Promise.all([fetchStatus(), fetchViolations()]);
        if (cancelled) return;

        const activeWorkers = Math.max(status.activeWorkers ?? 0, 1);
        const issues = status.missing ?? [];
        const compliance = status.required.length
          ? Math.round(((status.required.length - issues.length) / status.required.length) * 100)
          : 100;

        const cards = Array.from({ length: activeWorkers }).map((_, index) => ({
          id: `worker-${index + 1}`,
          name: `Live Worker ${index + 1}`,
          compliance,
          issues: violations.length > 0 ? issues : [],
        }));

        setWorkers(cards);
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
    <AppLayout title="Worker Management" subtitle={`${workers.length} workers currently visible`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-5 text-muted-foreground">
            No workers detected by live camera.
          </div>
        ) : (
          workers.map((w) => (
            <div key={w.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{w.name}</p>
                  <p className="text-xs text-muted-foreground">Source: Live Detection</p>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs text-muted-foreground">Compliance</p>
                <p className="text-lg font-bold text-foreground">{w.compliance}%</p>
              </div>

              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full ${getBarColor(w.compliance)}`} style={{ width: `${w.compliance}%` }} />
              </div>

              <p className="text-xs text-muted-foreground">
                {w.issues.length > 0 ? `Current issues: ${w.issues.map(formatIssueLabel).join(", ")}` : "No active PPE issues"}
              </p>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
