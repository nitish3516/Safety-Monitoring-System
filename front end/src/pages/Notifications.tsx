import { AppLayout } from "@/components/AppLayout";
import { fetchViolations } from "@/lib/api";
import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  message: string;
  time: string;
  detected: string;
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const violations = await fetchViolations();
        if (cancelled) return;

        const items: NotificationItem[] = violations
          .slice()
          .reverse()
          .slice(0, 10)
          .map((v, index) => ({
            id: v.id ?? `legacy:${v.time}::${v.image ?? ""}::${index}`,
            message: `Violation detected: ${v.missing.join(", ") || "Unknown"}`,
            time: v.time,
            detected: (v.detected ?? []).join(", "),
          }));

        setNotifications(items);
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
    <AppLayout title="Notifications" subtitle="Real-time Alerts">
      {notifications.length === 0 ? (
        <p className="text-muted-foreground">No notifications available</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="border p-3 rounded-lg">
              <p className="text-sm font-medium">{n.message}</p>
              <p className="text-xs text-muted-foreground">
                Detected: {n.detected || "-"}
              </p>
              <p className="text-xs text-muted-foreground">{n.time}</p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
