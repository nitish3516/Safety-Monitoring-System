import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export function AppLayout({ children, title, subtitle, headerAction }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!headerAction && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {formattedDate}, {formattedTime}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-success/30 text-success text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                SYSTEM ONLINE
              </span>
            </>
          )}
          {headerAction}
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
        {children}
      </main>
    </div>
  );
}
