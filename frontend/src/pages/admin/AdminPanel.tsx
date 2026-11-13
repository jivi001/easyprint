import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Printer,
  HardDrive,
  Activity,
  FileCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  CreditCard,
  Coins,
} from "lucide-react";
import { api } from "../../services/api";
import { AdminReport, AuditLogItem, User as UserModel } from "../../types";

export const AdminPanel: React.FC = () => {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "audit">("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchUser, setSearchUser] = useState<string>("");

  const loadAdminData = async () => {
    try {
      const [rep, uList, logs] = await Promise.all([
        api.getAdminReports(),
        api.listUsers(),
        api.getAuditLogs(),
      ]);
      setReport(rep);
      setUsers(uList);
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to load admin data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      setFeedback({ type: "success", message: `Updated user role to ${newRole}` });
      await loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update user role" });
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      await api.updateUserRole(userId, "student", !currentStatus);
      setFeedback({ type: "success", message: `User status updated.` });
      await loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to toggle status" });
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchUser.toLowerCase();
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-pe-surface p-6 rounded-pe-md border border-pe-border shadow-pe-card">
        <div>
          <h1 className="text-xl font-semibold text-pe-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-pe-accent" />
            Administration & System Auditing
          </h1>
          <p className="text-xs text-pe-text-secondary mt-1">
            System health analytics, user role governance, and immutable audit logs.
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-pe-text bg-pe-surface-secondary hover:bg-[#E5E5EA] border border-pe-border rounded-pe-sm transition self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Metrics
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-pe-sm border flex items-center justify-between gap-3 text-sm ${
            feedback.type === "success"
              ? "bg-[#EBF7EE] border-[#CDEED5] text-[#248A3D]"
              : "bg-[#FDEBED] border-[#F8C8CC] text-[#D70015]"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Admin Tabs - Restrained Single Accent, Accessible Touch Targets */}
      <div className="flex items-center gap-1 border-b border-pe-border overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center ${
            activeTab === "overview"
              ? "border-pe-accent text-pe-accent font-semibold"
              : "border-transparent text-pe-text-secondary hover:text-pe-text"
          }`}
        >
          System Overview
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center ${
            activeTab === "users"
              ? "border-pe-accent text-pe-accent font-semibold"
              : "border-transparent text-pe-text-secondary hover:text-pe-text"
          }`}
        >
          User Management ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center ${
            activeTab === "audit"
              ? "border-pe-accent text-pe-accent font-semibold"
              : "border-transparent text-pe-text-secondary hover:text-pe-text"
          }`}
        >
          Forensic Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: System Overview */}
      {activeTab === "overview" && report && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-2">
              <div className="flex items-center justify-between text-pe-text-secondary">
                <span className="text-xs font-medium">Registered Users</span>
                <Users className="w-4 h-4 text-pe-accent" />
              </div>
              <p className="text-2xl font-semibold text-pe-text tabular-nums">{report.total_users}</p>
              <div className="text-xs text-pe-text-secondary tabular-nums">
                {report.total_students} Students • {report.total_staff} Staff/Admin
              </div>
            </div>

            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-2">
              <div className="flex items-center justify-between text-pe-text-secondary">
                <span className="text-xs font-medium">Print Jobs</span>
                <Printer className="w-4 h-4 text-pe-success" />
              </div>
              <p className="text-2xl font-semibold text-pe-text tabular-nums">{report.total_print_requests}</p>
              <div className="text-xs text-pe-text-secondary tabular-nums">
                {report.requests_by_status["COLLECTED"] || 0} completed
              </div>
            </div>

            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-2">
              <div className="flex items-center justify-between text-pe-text-secondary">
                <span className="text-xs font-medium">Physical Pages</span>
                <FileCheck className="w-4 h-4 text-pe-warning" />
              </div>
              <p className="text-2xl font-semibold text-pe-text tabular-nums">{report.total_pages_printed_approx}</p>
              <div className="text-xs text-pe-text-secondary">Estimated total pages</div>
            </div>

            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-2">
              <div className="flex items-center justify-between text-pe-text-secondary">
                <span className="text-xs font-medium">Storage Footprint</span>
                <HardDrive className="w-4 h-4 text-pe-text-secondary" />
              </div>
              <p className="text-2xl font-semibold text-pe-text tabular-nums">
                {(report.total_storage_bytes / (1024 * 1024)).toFixed(2)} MB
              </p>
              <div className="text-xs text-pe-text-secondary tabular-nums">{report.total_documents_uploaded} files</div>
            </div>
          </div>

          {/* Financial & Revenue Settlement Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-1">
              <div className="flex items-center justify-between text-pe-text-secondary text-xs">
                <span className="font-medium">Total Print Revenue</span>
                <DollarSign className="w-4 h-4 text-[#248A3D]" />
              </div>
              <p className="text-2xl font-bold text-pe-text tabular-nums">
                ${(report.total_revenue || 0).toFixed(2)} <span className="text-xs text-pe-text-secondary font-normal">USD</span>
              </p>
              <div className="text-[11px] text-pe-text-secondary">
                {report.total_paid_requests || 0} jobs settled to staff
              </div>
            </div>

            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-1">
              <div className="flex items-center justify-between text-pe-text-secondary text-xs">
                <span className="font-medium">Payment Settlement Ratio</span>
                <Coins className="w-4 h-4 text-pe-accent" />
              </div>
              <p className="text-2xl font-bold text-pe-text tabular-nums">
                {report.total_print_requests > 0
                  ? `${Math.round(((report.total_paid_requests || 0) / report.total_print_requests) * 100)}%`
                  : "0%"}
              </p>
              <div className="text-[11px] text-pe-text-secondary tabular-nums">
                {report.total_paid_requests || 0} Paid • {report.total_unpaid_requests || 0} Unpaid
              </div>
            </div>

            <div className="bg-pe-surface p-5 rounded-pe-md border border-pe-border shadow-pe-card space-y-1">
              <div className="flex items-center justify-between text-pe-text-secondary text-xs">
                <span className="font-medium">Settlement Channels</span>
                <CreditCard className="w-4 h-4 text-pe-accent" />
              </div>
              <div className="pt-1 flex items-center gap-2 flex-wrap text-xs text-pe-text tabular-nums">
                {report.revenue_by_method && Object.keys(report.revenue_by_method).length > 0 ? (
                  Object.entries(report.revenue_by_method).map(([m, val]) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-pe-surface-secondary rounded border border-pe-border-subtle"
                    >
                      <span className="capitalize font-medium">{m}:</span>
                      <span>${val.toFixed(2)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-pe-text-secondary italic">No channel transactions yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-pe-surface p-6 rounded-pe-md border border-pe-border shadow-pe-card">
            <h3 className="text-sm font-semibold text-pe-text mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-pe-accent" />
              Workflow Queue Distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(report.requests_by_status).map(([st, cnt]) => (
                <div key={st} className="p-3 bg-pe-surface-secondary rounded-pe-sm border border-pe-border-subtle text-center">
                  <span className="text-xs font-medium text-pe-text-secondary block capitalize">{st.toLowerCase()}</span>
                  <span className="text-xl font-semibold text-pe-text mt-1 block tabular-nums">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: User Management */}
      {activeTab === "users" && (
        <div className="bg-pe-surface rounded-pe-md border border-pe-border shadow-pe-card overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold text-sm text-pe-text">User Accounts Directory</h3>
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-pe-text-secondary" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Filter users..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-pe-border rounded-pe-sm focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
              />
            </div>
          </div>

          {/* Mobile Stacked User Cards (< 768px) */}
          <div className="block md:hidden divide-y divide-pe-border-subtle">
            {filteredUsers.map((u) => (
              <div key={u.id} className="py-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-pe-text">{u.name}</p>
                    <p className="text-xs text-pe-text-secondary mt-0.5">{u.email}</p>
                  </div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      u.is_active ? "bg-[#EBF7EE] text-[#1B7029]" : "bg-[#FDEBED] text-[#B80012]"
                    }`}
                  >
                    {u.is_active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-pe-border-subtle/70">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-pe-text-secondary">Role:</span>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="min-h-[44px] text-xs px-3 py-2 bg-pe-surface border border-pe-border rounded-pe-sm capitalize focus:ring-1 focus:ring-pe-accent font-medium text-pe-text"
                    >
                      <option value="student">Student</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-pe-sm text-xs font-semibold transition border ${
                      u.is_active
                        ? "text-pe-danger bg-[#FDEBED] border-[#F8C8CC] hover:bg-[#FCD8DC]"
                        : "text-pe-success bg-[#EBF7EE] border-[#CDEED5] hover:bg-[#DDF3E3]"
                    }`}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop User Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-pe-surface-secondary border-b border-pe-border text-pe-text-secondary font-medium">
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pe-border-subtle">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-pe-surface-secondary/50">
                    <td className="py-3 px-4 font-medium text-pe-text">{u.name}</td>
                    <td className="py-3 px-4 text-pe-text-secondary">{u.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="min-h-[44px] text-xs px-3 py-2 bg-pe-surface border border-pe-border rounded-pe-sm capitalize focus:ring-1 focus:ring-pe-accent font-medium"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.is_active ? "bg-[#EBF7EE] text-[#1B7029]" : "bg-[#FDEBED] text-[#B80012]"
                        }`}
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-pe-sm transition border ${
                          u.is_active
                            ? "text-pe-danger bg-[#FDEBED] border-[#F8C8CC] hover:bg-[#FCD8DC]"
                            : "text-pe-success bg-[#EBF7EE] border-[#CDEED5] hover:bg-[#DDF3E3]"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Forensic Audit Trail */}
      {activeTab === "audit" && (
        <div className="bg-pe-surface rounded-pe-md border border-pe-border shadow-pe-card overflow-hidden p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-pe-text">Forensic Audit Log Trail</h3>
            <p className="text-xs text-pe-text-secondary">Immutable record of security events, status updates, and document streams</p>
          </div>

          {/* Mobile Stacked Audit Log Cards (< 768px) */}
          <div className="block md:hidden divide-y divide-pe-border-subtle">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3.5 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-pe-text">{log.action}</span>
                  <span className="text-pe-text-secondary tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <div className="text-pe-text-secondary text-xs space-y-0.5">
                  <p><span className="text-pe-text-secondary/70">Actor:</span> {log.user_email || "System"}</p>
                  <p><span className="text-pe-text-secondary/70">Entity:</span> {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ""}</p>
                  <p><span className="text-pe-text-secondary/70">IP:</span> {log.ip_address || "local"}</p>
                </div>
                {log.details && (
                  <div className="bg-pe-surface-secondary p-2 rounded-pe-xs border border-pe-border-subtle text-xs text-pe-text break-all font-sans">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Audit Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-pe-surface-secondary border-b border-pe-border text-pe-text-secondary font-medium">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">IP Address</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pe-border-subtle font-mono text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-pe-surface-secondary/50">
                    <td className="py-2.5 px-4 text-pe-text-secondary whitespace-nowrap tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-pe-text">{log.action}</td>
                    <td className="py-2.5 px-4 text-pe-text-secondary">{log.user_email || "System"}</td>
                    <td className="py-2.5 px-4 text-pe-text-secondary">
                      {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ""}
                    </td>
                    <td className="py-2.5 px-4 text-pe-text-secondary tabular-nums">{log.ip_address || "local"}</td>
                    <td className="py-2.5 px-4 text-pe-text-secondary truncate max-w-xs font-sans">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
