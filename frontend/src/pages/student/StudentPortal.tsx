import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  Clock,
  Printer,
  Download,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api } from "../../services/api";
import { DocumentItem, PrintRequest, ColorMode, DuplexMode } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";

export const StudentPortal: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [duplex, setDuplex] = useState<DuplexMode>("single");
  const [pageRange, setPageRange] = useState<string>("all");
  const [orientation, setOrientation] = useState<string>("portrait");
  const [paperSize, setPaperSize] = useState<string>("A4");

  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [docs, reqs] = await Promise.all([
        api.listDocuments(),
        api.listPrintRequests(),
      ]);
      setDocuments(docs);
      setRequests(reqs);
      if (docs.length > 0 && !selectedDocId) {
        setSelectedDocId(docs[0].id);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setFeedback({ type: "error", message: "Only PDF documents (.pdf) are permitted." });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: "error", message: "File exceeds the 10 MB maximum limit." });
      return;
    }

    setUploading(true);
    setFeedback(null);
    try {
      const uploaded = await api.uploadDocument(file);
      setFeedback({ type: "success", message: `Uploaded '${uploaded.file_name}' successfully.` });
      await loadData();
      setSelectedDocId(uploaded.id);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Upload failed." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setFeedback({ type: "error", message: "Please select or upload a document first." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await api.createPrintRequest({
        document_id: selectedDocId,
        copies,
        color_mode: colorMode,
        duplex,
        page_range: pageRange,
        orientation,
        paper_size: paperSize,
      });
      setFeedback({ type: "success", message: "Print request submitted! Status is PENDING." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to submit print request." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this pending print request?")) return;
    try {
      await api.updateRequestStatus(id, "CANCELLED", "Cancelled by student");
      setFeedback({ type: "success", message: "Print request cancelled." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to cancel request." });
    }
  };

  const handleDownload = async (docId: string, filename?: string) => {
    try {
      await api.downloadDocument(docId, filename || "document.pdf");
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Download failed." });
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Banner / Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-pe-sm border flex items-start justify-between gap-3 text-sm transition-all ${
            feedback.type === "success"
              ? "bg-[#EBF7EE] border-[#CDEED5] text-[#248A3D]"
              : "bg-[#FDEBED] border-[#F8C8CC] text-[#D70015]"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Upload & Configuration on left, Active Jobs on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Submit New Print Request */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-pe-surface rounded-pe-md p-6 border border-pe-border shadow-pe-card">
            <h2 className="text-lg font-semibold text-pe-text mb-1 flex items-center gap-2">
              <Printer className="w-5 h-5 text-pe-accent" />
              New Print Request
            </h2>
            <p className="text-xs text-pe-text-secondary mb-5">
              Upload a verified PDF and select copies, color, and duplex settings.
            </p>

            {/* Document Upload Box */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-pe-text mb-2">
                1. Upload PDF Document (max 10 MB)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-pe-border hover:border-pe-accent rounded-pe-sm p-5 text-center cursor-pointer transition bg-pe-surface-secondary/50 hover:bg-[#EBF5FF]/30 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />
                <div className="v3-upload-icon inline-flex items-center justify-center w-11 h-11 rounded-pe-md bg-pe-surface-secondary text-pe-text mb-2 transition-all border border-pe-border-subtle group-hover:bg-pe-accent group-hover:text-white">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <p className="text-sm font-semibold text-pe-text">
                  {uploading ? "Validating signature..." : "Click to select PDF document"}
                </p>
                <p className="text-xs text-pe-text-secondary mt-1">Strict %PDF- signature validation and private storage</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              {/* Document Selector */}
              <div>
                <label className="block text-sm font-semibold text-pe-text mb-1.5">
                  2. Select Document
                </label>
                {documents.length === 0 ? (
                  <p className="text-xs text-pe-text-secondary italic">No uploaded documents yet.</p>
                ) : (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.file_name} ({(doc.file_size / 1024).toFixed(1)} KB)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Print Configuration Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-sm font-semibold text-pe-text mb-1.5">Copies</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text tabular-nums focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-pe-text mb-1.5">Color Mode</label>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as ColorMode)}
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  >
                    <option value="bw">Black & White</option>
                    <option value="color">Full Color</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-pe-text mb-1.5">Sides</label>
                  <select
                    value={duplex}
                    onChange={(e) => setDuplex(e.target.value as DuplexMode)}
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  >
                    <option value="single">Single-sided</option>
                    <option value="double">Double-sided (Duplex)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-pe-text mb-1.5">Page Range</label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    placeholder="all or 1-5"
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-pe-text mb-1.5">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">US Letter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-pe-text mb-1.5">Orientation</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedDocId}
                className="w-full mt-3 min-h-[44px] px-4 py-2.5 bg-pe-surface hover:bg-pe-surface-secondary text-pe-text text-sm rounded-pe-sm border border-pe-border transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-pe-text" />
                    <span className="font-semibold text-pe-text text-sm">Submit</span>
                    <span className="font-medium text-pe-text text-sm">Print Request</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Track Print Requests */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-pe-surface rounded-pe-md p-6 border border-pe-border shadow-pe-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-pe-text flex items-center gap-2">
                  <Clock className="w-5 h-5 text-pe-accent" />
                  My Print Requests ({requests.length})
                </h2>
                <p className="text-xs text-pe-text-secondary">Live request status and self-service pickup readiness</p>
              </div>
              <button
                onClick={loadData}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-pe-text-secondary hover:text-pe-text rounded-pe-sm hover:bg-pe-surface-secondary transition"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="p-8 text-center text-xs text-pe-text-secondary bg-pe-surface-secondary rounded-pe-sm border border-pe-border-subtle">
                No print requests submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-pe-border-subtle overflow-x-auto">
                {requests.map((req) => (
                  <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <FileText className="w-4 h-4 text-pe-accent flex-shrink-0" />
                        <span className="font-medium text-sm text-pe-text">
                          {req.document_name || "Document"}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <div className="text-xs text-pe-text-secondary flex items-center gap-2.5 flex-wrap tabular-nums">
                        <span>{req.copies} {req.copies === 1 ? "copy" : "copies"}</span>
                        <span>•</span>
                        <span className="capitalize">{req.color_mode === "bw" ? "B&W" : "Color"}</span>
                        <span>•</span>
                        <span className="capitalize">{req.duplex}</span>
                        <span>•</span>
                        <span>Pages: {req.page_range}</span>
                        <span>•</span>
                        <span>{new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Download document */}
                      <button
                        onClick={() => handleDownload(req.document_id, req.document_name)}
                        className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-pe-text bg-pe-surface hover:bg-pe-surface-secondary border border-pe-border rounded-pe-sm transition flex items-center gap-1.5 shadow-sm"
                        title="Download uploaded PDF"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>

                      {/* Cancel option only if still pending */}
                      {req.status === "PENDING" && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-pe-danger bg-[#FDEBED] hover:bg-[#FCD8DC] border border-[#F8C8CC] rounded-pe-sm transition flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
