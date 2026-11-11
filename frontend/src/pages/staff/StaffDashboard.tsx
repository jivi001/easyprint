import React, { useState, useEffect } from "react";
import {
  Printer,
  Download,
  Play,
  CheckCircle,
  PackageCheck,
  AlertTriangle,
  History,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
} from "lucide-react";
import { api } from "../../services/api";
import { PrintRequest, RequestStatus } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";

export const StaffDashboard: React.FC = () => {
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRequest, setSelectedRequest] = useState<PrintRequest | null>(null);
  const [failComment, setFailComment] = useState<string>("");
  const [showFailModal, setShowFailModal] = useState<boolean>(false);
  const [targetFailId, setTargetFailId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadQueue = async () => {
    try {
      const statusParam = filter === "ALL" ? undefined : (filter as RequestStatus);
      const data = await api.listPrintRequests(statusParam);
      setRequests(data);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to load queue" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 8000);
    return () => clearInterval(interval);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRequest(null);
        setShowFailModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleStatusTransition = async (id: string, newStatus: RequestStatus, comment?: string) => {
    try {
      await api.updateRequestStatus(id, newStatus, comment);
      setFeedback({ type: "success", message: `Updated request status to ${newStatus}` });
      await loadQueue();
      if (selectedRequest && selectedRequest.id === id) {
        const updated = await api.getPrintRequest(id);
        setSelectedRequest(updated);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Status update failed." });
    }
  };

  const handleDownloadForPrint = async (docId: string, filename?: string) => {
    try {
      await api.downloadDocument(docId, filename || "job.pdf");
      setFeedback({ type: "success", message: "PDF downloaded for printing on connected printer." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to download document" });
    }
  };

  const handleOpenFailModal = (id: string) => {
    setTargetFailId(id);
    setFailComment("Hardware error or out of paper");
    setShowFailModal(true);
  };

  const handleConfirmFail = async () => {
    if (!targetFailId) return;
    await handleStatusTransition(targetFailId, "FAILED", failComment);
    setShowFailModal(false);
    setTargetFailId(null);
  };

  const handleViewHistory = async (req: PrintRequest) => {
    try {
      const detailed = await api.getPrintRequest(req.id);
      setSelectedRequest(detailed);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to fetch details" });
    }
  };

  const filteredRequests = requests.filter((r) => {
    const term = search.toLowerCase();
    const matchName = r.document_name?.toLowerCase().includes(term);
    const matchStudent = r.student_name?.toLowerCase().includes(term) || r.student_email?.toLowerCase().includes(term);
    return matchName || matchStudent;
  });

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-pe-surface p-6 rounded-pe-md border border-pe-border shadow-pe-card">
        <div>
          <h1 className="text-xl font-semibold text-pe-text flex items-center gap-2">
            <Printer className="w-5 h-5 text-pe-accent" />
            Print-Center Workstation Queue
          </h1>
          <p className="text-xs text-pe-text-secondary mt-1">
            Manual staff-controlled printing workflow. Review jobs, download PDFs, print on physical printer, and stage for pickup.
          </p>
        </div>

        <button
          onClick={loadQueue}
          className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-pe-text bg-pe-surface-secondary hover:bg-[#E5E5EA] border border-pe-border rounded-pe-sm transition self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Queue
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {["ALL", "PENDING", "PROCESSING", "READY", "COLLECTED", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`min-h-[44px] px-3.5 py-2 rounded-pe-sm text-xs font-medium whitespace-nowrap transition flex items-center ${
                filter === st
                  ? "bg-pe-accent text-white shadow-sm"
                  : "bg-pe-surface text-pe-text-secondary hover:text-pe-text border border-pe-border"
              }`}
            >
              {st === "ALL" ? "All Requests" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-pe-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or file..."
            className="w-full min-h-[44px] pl-9 pr-3 py-2.5 text-xs border border-pe-border rounded-pe-sm bg-pe-surface focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
          />
        </div>
      </div>

      {/* Queue Table (Desktop) & Stacked Cards (Mobile) */}
      <div className="bg-pe-surface rounded-pe-md border border-pe-border shadow-pe-card overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-sm text-pe-text-secondary">
            No print requests match the selected queue filter.
          </div>
        ) : (
          <>
            {/* Mobile Stacked Card View (< 768px) */}
            <div className="block md:hidden divide-y divide-pe-border-subtle">
              {filteredRequests.map((req) => (
                <div key={req.id} className="p-4 space-y-3 hover:bg-pe-surface-secondary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-pe-text">
                        <User className="w-4 h-4 text-pe-text-secondary" />
                        <span>{req.student_name || "Student"}</span>
                      </div>
                      <p className="text-xs text-pe-text-secondary mt-0.5">{req.student_email}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="bg-pe-surface-secondary p-3 rounded-pe-sm border border-pe-border-subtle space-y-1">
                    <div className="flex items-center gap-2 font-medium text-xs text-pe-text truncate">
                      <FileText className="w-4 h-4 text-pe-accent flex-shrink-0" />
                      <span className="truncate">{req.document_name}</span>
                    </div>
                    <div className="text-xs text-pe-text-secondary flex items-center gap-2 flex-wrap tabular-nums pt-1 border-t border-pe-border-subtle/70">
                      <span><strong className="text-pe-text">{req.copies}</strong> {req.copies === 1 ? "copy" : "copies"}</span>
                      <span>•</span>
                      <span className="capitalize">{req.color_mode === "bw" ? "B&W" : "Color"}</span>
                      <span>•</span>
                      <span className="capitalize">{req.duplex}</span>
                      <span>•</span>
                      <span>Pages: {req.page_range}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-pe-text-secondary tabular-nums">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleDownloadForPrint(req.document_id, req.document_name)}
                        className="min-h-[44px] px-3 py-2 bg-pe-surface hover:bg-pe-surface-secondary text-pe-accent font-medium rounded-pe-sm border border-pe-border text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </button>

                      {req.status === "PENDING" && (
                        <button
                          onClick={() => handleStatusTransition(req.id, "PROCESSING", "Staff initiated print job")}
                          className="min-h-[44px] px-3.5 py-2 bg-[#FFF8E6] hover:bg-[#FFF2CC] text-[#7A5200] border border-[#F2E5C2] font-semibold rounded-pe-sm text-xs flex items-center gap-1 shadow-sm"
                        >
                          <Play className="w-4 h-4 fill-current" /> Start
                        </button>
                      )}

                      {req.status === "PROCESSING" && (
                        <button
                          onClick={() => handleStatusTransition(req.id, "READY", "Printed and placed in pickup tray")}
                          className="min-h-[44px] px-3.5 py-2 bg-[#EBF7EE] hover:bg-[#DDF3E3] text-[#1B7029] border border-[#CDEED5] font-semibold rounded-pe-sm text-xs flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" /> Ready
                        </button>
                      )}

                      {req.status === "READY" && (
                        <button
                          onClick={() => handleStatusTransition(req.id, "COLLECTED", "Confirmed collection by student")}
                          className="min-h-[44px] px-3.5 py-2 bg-pe-surface hover:bg-pe-surface-secondary text-pe-text font-semibold rounded-pe-sm border border-pe-border text-xs flex items-center gap-1 shadow-sm"
                        >
                          <PackageCheck className="w-4 h-4" /> Collected
                        </button>
                      )}

                      {req.status === "PROCESSING" && (
                        <button
                          onClick={() => handleOpenFailModal(req.id)}
                          className="min-h-[44px] px-2 text-pe-danger hover:bg-[#FDEBED] rounded-pe-sm"
                          title="Mark as Failed"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleViewHistory(req)}
                        className="min-h-[44px] px-2 text-pe-text-secondary hover:text-pe-text"
                        title="View History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-pe-surface-secondary border-b border-pe-border text-pe-text-secondary font-medium">
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Document</th>
                    <th className="py-3 px-4">Print Specs</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pe-border-subtle">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-pe-surface-secondary/50 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-pe-text-secondary whitespace-nowrap tabular-nums">
                        {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <span className="block text-xs text-pe-text-secondary/70">
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-pe-text-secondary" />
                          <span className="font-medium text-pe-text">{req.student_name || "Student"}</span>
                        </div>
                        <span className="text-xs text-pe-text-secondary block">{req.student_email}</span>
                      </td>

                      {/* Document */}
                      <td className="py-3.5 px-4 font-medium text-pe-text">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-pe-accent flex-shrink-0" />
                          <span className="truncate max-w-xs" title={req.document_name}>
                            {req.document_name}
                          </span>
                        </div>
                        <span className="text-xs text-pe-text-secondary tabular-nums">
                          {req.file_size ? `${(req.file_size / 1024).toFixed(1)} KB` : "PDF"}
                        </span>
                      </td>

                      {/* Print Specs */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-xs text-pe-text-secondary">
                          <div>
                            <strong className="text-pe-text tabular-nums">{req.copies}</strong> {req.copies === 1 ? "copy" : "copies"}
                          </div>
                          <div className="capitalize text-pe-text-secondary">
                            {req.color_mode === "bw" ? "B&W" : "Color"} • {req.duplex}
                          </div>
                          <div className="tabular-nums">Pages: {req.page_range}</div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Workflow Actions with 44px Touch Targets */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadForPrint(req.document_id, req.document_name)}
                            className="min-h-[44px] px-3.5 py-2.5 bg-pe-surface hover:bg-pe-surface-secondary text-pe-accent font-medium rounded-pe-sm border border-pe-border transition flex items-center gap-1.5 text-xs shadow-sm"
                            title="Download PDF to print on college printer"
                          >
                            <Download className="w-4 h-4" /> Print PDF
                          </button>

                          {req.status === "PENDING" && (
                            <button
                              onClick={() => handleStatusTransition(req.id, "PROCESSING", "Staff initiated print job")}
                              className="min-h-[44px] px-3.5 py-2.5 bg-[#FFF8E6] hover:bg-[#FFF2CC] text-[#7A5200] border border-[#F2E5C2] font-semibold rounded-pe-sm transition flex items-center gap-1.5 text-xs shadow-sm"
                            >
                              <Play className="w-4 h-4 fill-current" /> Start
                            </button>
                          )}

                          {req.status === "PROCESSING" && (
                            <button
                              onClick={() => handleStatusTransition(req.id, "READY", "Printed and placed in pickup tray")}
                              className="min-h-[44px] px-3.5 py-2.5 bg-[#EBF7EE] hover:bg-[#DDF3E3] text-[#1B7029] border border-[#CDEED5] font-semibold rounded-pe-sm transition flex items-center gap-1.5 text-xs shadow-sm"
                            >
                              <CheckCircle className="w-4 h-4" /> Mark Ready
                            </button>
                          )}

                          {req.status === "READY" && (
                            <button
                              onClick={() => handleStatusTransition(req.id, "COLLECTED", "Confirmed collection by student")}
                              className="min-h-[44px] px-3.5 py-2.5 bg-pe-surface hover:bg-pe-surface-secondary text-pe-text font-semibold rounded-pe-sm border border-pe-border transition flex items-center gap-1.5 text-xs shadow-sm"
                            >
                              <PackageCheck className="w-4 h-4" /> Collected
                            </button>
                          )}

                          {req.status === "PROCESSING" && (
                            <button
                              onClick={() => handleOpenFailModal(req.id)}
                              className="min-h-[44px] px-2.5 text-pe-danger hover:bg-[#FDEBED] rounded-pe-sm transition flex items-center"
                              title="Mark as Failed"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleViewHistory(req)}
                            className="min-h-[44px] px-2.5 text-pe-text-secondary hover:text-pe-text hover:bg-pe-surface-secondary rounded-pe-sm transition flex items-center"
                            title="View Status History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Status History Modal */}
      {selectedRequest && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRequest(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="bg-pe-surface rounded-pe-lg max-w-lg w-full p-6 shadow-pe-popover border border-pe-border space-y-4">
            <div className="flex items-center justify-between border-b border-pe-border-subtle pb-3">
              <div>
                <h3 className="font-semibold text-base text-pe-text">Job Status & Audit History</h3>
                <p className="text-xs text-pe-text-secondary">{selectedRequest.document_name}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-pe-text-secondary hover:text-pe-text font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {selectedRequest.status_history && selectedRequest.status_history.length > 0 ? (
                selectedRequest.status_history.map((h, idx) => (
                  <div key={h.id || idx} className="flex items-start gap-3 text-xs">
                    <div className="h-6 w-6 rounded-full bg-[#EBF5FF] text-pe-accent flex items-center justify-center font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-pe-surface-secondary p-3 rounded-pe-sm border border-pe-border-subtle">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-pe-text">
                          {h.old_status} → {h.new_status}
                        </span>
                        <span className="text-xs text-pe-text-secondary tabular-nums">
                          {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      {h.comment && <p className="text-pe-text mt-1 italic">"{h.comment}"</p>}
                      <span className="text-xs text-pe-text-secondary mt-0.5 block">Actor: {h.changed_by_name || "System"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-pe-text-secondary text-center py-4">No status history records found.</p>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-pe-surface-secondary hover:bg-[#E5E5EA] text-pe-text font-medium text-xs rounded-pe-sm transition border border-pe-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fail Job Modal */}
      {showFailModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFailModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="bg-pe-surface rounded-pe-lg max-w-sm w-full p-6 shadow-pe-popover border border-pe-border space-y-4">
            <h3 className="font-semibold text-base text-pe-danger flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Mark Job as Failed
            </h3>
            <p className="text-xs text-pe-text-secondary">
              Please specify the failure reason for student notification:
            </p>
            <textarea
              value={failComment}
              onChange={(e) => setFailComment(e.target.value)}
              className="w-full p-2.5 border border-pe-border rounded-pe-sm text-xs bg-pe-surface focus:outline-none focus:ring-2 focus:ring-pe-danger/20"
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFailModal(false)}
                className="px-3 py-1.5 text-xs text-pe-text-secondary hover:bg-pe-surface-secondary rounded-pe-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFail}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-pe-danger hover:bg-[#AB0010] rounded-pe-sm shadow-sm"
              >
                Confirm Failure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
