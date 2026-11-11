import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { StudentPortal } from "./pages/student/StudentPortal";
import { StaffDashboard } from "./pages/staff/StaffDashboard";
import { AdminPanel } from "./pages/admin/AdminPanel";
import { Loader2 } from "lucide-react";

export const App: React.FC = () => {
  const { user, loading, isAuthenticated, hasRole } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeTab, setActiveTab] = useState<string>("student");

  // Sync active tab with user role upon login
  React.useEffect(() => {
    if (user) {
      if (user.role === "staff") {
        setActiveTab("staff");
      } else if (user.role === "admin") {
        setActiveTab("admin");
      } else {
        setActiveTab("student");
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pe-bg">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-pe-accent animate-spin" />
          <p className="text-xs text-pe-text-secondary font-medium">Loading PrintEasy...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authMode === "login" ? (
      <Login onSwitchToRegister={() => setAuthMode("register")} />
    ) : (
      <Register onSwitchToLogin={() => setAuthMode("login")} />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-pe-bg text-pe-text">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1">
        {activeTab === "student" && (hasRole("student") || hasRole("admin")) && (
          <StudentPortal />
        )}
        {activeTab === "staff" && (hasRole("staff") || hasRole("admin")) && (
          <StaffDashboard />
        )}
        {activeTab === "admin" && hasRole("admin") && <AdminPanel />}
      </main>

      <footer className="border-t border-pe-border bg-pe-surface py-4 text-center text-xs text-pe-text-secondary">
        PrintEasy — College Printing Management Platform • Academic Atelier Design System
      </footer>
    </div>
  );
};
