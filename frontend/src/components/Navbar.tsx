import React from "react";
import { Printer, LogOut, User as UserIcon, Shield, Briefcase, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NotificationDropdown } from "./NotificationDropdown";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const { user, logout, hasRole } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="bg-pe-surface-secondary text-pe-text-secondary border border-pe-border text-xs font-medium px-2 py-0.5 rounded-full">
            Admin
          </span>
        );
      case "staff":
        return (
          <span className="bg-[#EBF5FF] text-[#0071E3] border border-[#CCE4FF] text-xs font-medium px-2 py-0.5 rounded-full">
            Staff
          </span>
        );
      default:
        return (
          <span className="bg-pe-surface-secondary text-pe-text-secondary border border-pe-border text-xs font-medium px-2 py-0.5 rounded-full">
            Student
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-pe-surface border-b border-pe-border">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-pe-sm bg-pe-accent flex items-center justify-center text-white">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-lg text-pe-text tracking-tight flex items-center gap-2">
              PrintEasy
              <span className="text-xs font-normal text-pe-text-secondary hidden sm:inline">| College Print Center</span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs (RBAC aware) */}
        {user && (
          <nav className="flex items-center gap-1 bg-pe-surface-secondary p-1 rounded-pe-sm border border-pe-border-subtle overflow-x-auto">
            {/* Student Portal - available to student and admin */}
            {(hasRole("student") || hasRole("admin")) && (
              <button
                onClick={() => setActiveTab("student")}
                className={`min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-pe-xs text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === "student"
                    ? "bg-pe-surface text-pe-accent shadow-sm"
                    : "text-pe-text-secondary hover:text-pe-text"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>My Print Jobs</span>
              </button>
            )}

            {/* Staff Queue - available to staff and admin */}
            {(hasRole("staff") || hasRole("admin")) && (
              <button
                onClick={() => setActiveTab("staff")}
                className={`min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-pe-xs text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === "staff"
                    ? "bg-pe-surface text-pe-accent shadow-sm"
                    : "text-pe-text-secondary hover:text-pe-text"
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Staff Queue</span>
              </button>
            )}

            {/* Admin Panel - available only to admin */}
            {hasRole("admin") && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-pe-xs text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === "admin"
                    ? "bg-pe-surface text-pe-accent shadow-sm"
                    : "text-pe-text-secondary hover:text-pe-text"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin & Audits</span>
              </button>
            )}
          </nav>
        )}

        {/* Actions & Profile */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationDropdown />

            <div className="h-5 w-px bg-pe-border hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-pe-surface-secondary border border-pe-border flex items-center justify-center text-pe-text-secondary flex-shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="hidden md:block text-left text-xs">
                <p className="font-medium text-pe-text leading-tight">{user.name}</p>
                <p className="text-xs text-pe-text-secondary">{user.email}</p>
              </div>
              {getRoleBadge(user.role)}
            </div>

            <button
              onClick={logout}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-pe-text-secondary hover:text-pe-danger rounded-pe-xs hover:bg-[#FDEBED] transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
