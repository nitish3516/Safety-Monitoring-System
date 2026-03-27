import { 
  LayoutDashboard, Video, AlertTriangle, Users, MapPin, BarChart3, 
  Bell, Settings, X, Shield, ChevronDown, ChevronUp, LogOut, User
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { fetchViolations } from "@/lib/api";
import { logoutUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Live Detection", url: "/live-detection", icon: Video },
  { title: "Violations", url: "/violations", icon: AlertTriangle },
  { title: "Workers", url: "/workers", icon: Users },
  { title: "Camera Zones", url: "/camera-zones", icon: MapPin },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const [userExpanded, setUserExpanded] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadNotificationCount = async () => {
      try {
        const violations = await fetchViolations();
        if (!cancelled) {
          setNotificationCount(violations.length);
        }
      } catch {
        if (!cancelled) {
          setNotificationCount(0);
        }
      }
    };

    loadNotificationCount();
    const timer = setInterval(loadNotificationCount, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleLogout = () => {
    logoutUser();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <>
      {open && (
        <div 
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" 
          onClick={onClose} 
        />
      )}
      
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">PPE Guard AI</h2>
              <p className="text-xs text-muted-foreground">Safety Monitoring</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/dashboard"}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary"
              onClick={onClose}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.title}</span>
              {item.title === "Notifications" && notificationCount > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div className="border-t border-border p-3">
          <button
            onClick={() => setUserExpanded(!userExpanded)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Admin User</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
            {userExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          
          {userExpanded && (
            <div className="mt-2 mx-3">
              <div className="bg-muted/50 rounded-lg p-3 mb-2 text-xs">
                <p className="text-foreground">Email: admin@ppe.com</p>
                <p className="text-foreground mt-0.5">Role: admin</p>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg w-full transition-colors">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
