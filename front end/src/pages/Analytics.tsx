import { AppLayout } from "@/components/AppLayout";
import { fetchStatus, fetchViolations, violationCounts } from "@/lib/api";
import { useEffect, useState } from "react";

type AnalyticsData = {
  total: number;
  counts: Record<string, number>;
  compliance: string;
  activeWorkers: number;
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData>({ total: 0, counts: {}, compliance: "0%", activeWorkers: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [status, violations] = await Promise.all([fetchStatus(), fetchViolations()]);
        if (cancelled) return;

        const counts = violationCounts(violations);
        const compliance = status.required.length
          ? `${Math.round(((status.required.length - status.missing.length) / status.required.length) * 100)}%`
          : "100%";

        setData({
          total: violations.length,
          counts,
          compliance,
          activeWorkers: status.activeWorkers ?? 0,
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

  return (
    <AppLayout title="Analytics" subtitle="PPE Insights">
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <p>Total Violations: {data.total}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p>Active Workers: {data.activeWorkers}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p>Current Compliance: {data.compliance}</p>
        </div>
        {Object.keys(data.counts).length === 0 ? (
          <div className="p-4 border rounded-lg">
            <p>No missing PPE records yet.</p>
          </div>
        ) : (
          Object.entries(data.counts).map(([label, count]) => (
            <div key={label} className="p-4 border rounded-lg">
              <p>{label} Missing: {count}</p>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
