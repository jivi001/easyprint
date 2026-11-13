import React, { useState, useEffect } from "react";
import { X, Printer, CheckCircle2, Loader2 } from "lucide-react";
import { PaymentReceipt } from "../types";
import { api } from "../services/api";

interface PaymentReceiptModalProps {
  requestId: string;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  requestId,
  onClose,
}) => {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const data = await api.getPaymentReceipt(requestId);
        setReceipt(data);
      } catch (err: any) {
        setError(err.message || "Failed to load receipt details.");
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [requestId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
    >
      <div className="bg-pe-surface rounded-pe-lg max-w-md w-full border border-pe-border shadow-pe-popover overflow-hidden space-y-0 print:border-none print:shadow-none">
        {/* Header */}
        <div className="p-5 border-b border-pe-border-subtle flex items-center justify-between bg-pe-surface print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#248A3D]" />
            <h2 className="text-base font-semibold text-pe-text">Official Payment Receipt</h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-pe-text-secondary hover:text-pe-text rounded-pe-sm hover:bg-pe-surface-secondary transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-pe-text-secondary flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-pe-accent" />
              <span>Retrieving verified receipt...</span>
            </div>
          ) : error || !receipt ? (
            <div className="py-8 text-center text-xs text-pe-danger">
              {error || "Receipt not found."}
            </div>
          ) : (
            <div className="space-y-5 text-xs text-pe-text">
              {/* Institution Stamp */}
              <div className="text-center pb-4 border-b border-pe-border-subtle">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-pe-accent block mb-1">
                  PrintEasy Campus Print Center
                </span>
                <h3 className="text-lg font-semibold text-pe-text">Print Service Settlement</h3>
                <p className="text-xs text-pe-text-secondary mt-0.5 tabular-nums">
                  {new Date(receipt.paid_at).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              {/* References */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-pe-surface-secondary rounded-pe-sm border border-pe-border-subtle tabular-nums font-mono">
                <div>
                  <span className="text-pe-text-secondary text-[11px] block">Receipt Ref</span>
                  <span className="font-semibold text-pe-text">{receipt.receipt_number}</span>
                </div>
                <div>
                  <span className="text-pe-text-secondary text-[11px] block">Transaction ID</span>
                  <span className="font-semibold text-pe-text truncate block" title={receipt.transaction_id}>
                    {receipt.transaction_id}
                  </span>
                </div>
              </div>

              {/* Student & Job Details */}
              <div className="space-y-2 tabular-nums">
                <div className="flex justify-between py-1 border-b border-pe-border-subtle/60">
                  <span className="text-pe-text-secondary">Student</span>
                  <span className="font-medium text-pe-text">{receipt.student_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-pe-border-subtle/60">
                  <span className="text-pe-text-secondary">Document</span>
                  <span className="font-medium text-pe-text truncate max-w-[200px]" title={receipt.document_name}>
                    {receipt.document_name}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-pe-border-subtle/60">
                  <span className="text-pe-text-secondary">Print Specifications</span>
                  <span className="text-pe-text">
                    {receipt.total_pages} {receipt.total_pages === 1 ? "page" : "pages"} • {receipt.copies} {receipt.copies === 1 ? "copy" : "copies"} • {receipt.color_mode}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-pe-border-subtle/60">
                  <span className="text-pe-text-secondary">Page Rate</span>
                  <span className="text-pe-text">${receipt.rate_per_page.toFixed(2)} / page</span>
                </div>
                <div className="flex justify-between py-1 border-b border-pe-border-subtle/60">
                  <span className="text-pe-text-secondary">Payment Method</span>
                  <span className="capitalize text-pe-text font-medium">{receipt.payment_method}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-pe-border-subtle/60">
                  <span className="text-pe-text-secondary">Settled To</span>
                  <span className="text-pe-text">
                    {receipt.staff_receiver_name ? `Staff: ${receipt.staff_receiver_name}` : "Print Center Workstation"}
                  </span>
                </div>
              </div>

              {/* Financial Total */}
              <div className="p-3 bg-pe-surface-secondary/70 rounded-pe-sm border border-pe-border-subtle space-y-1.5 tabular-nums">
                <div className="flex justify-between text-xs text-pe-text-secondary">
                  <span>Subtotal</span>
                  <span>${receipt.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-pe-text-secondary">
                  <span>Campus Facility Fee</span>
                  <span>$0.00</span>
                </div>
                <div className="pt-1.5 border-t border-pe-border-subtle flex justify-between text-sm font-semibold text-pe-text">
                  <span>Total Settled</span>
                  <span className="text-pe-accent">${receipt.amount.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 min-h-[44px] px-3.5 py-2 bg-pe-surface hover:bg-pe-surface-secondary border border-pe-border text-pe-text rounded-pe-sm font-medium text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2 bg-pe-accent hover:bg-pe-accent-hover text-white rounded-pe-sm font-semibold text-xs transition shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
