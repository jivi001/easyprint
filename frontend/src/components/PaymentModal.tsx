import React, { useState, useEffect } from "react";
import {
  CreditCard,
  QrCode,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { PrintRequest, PaymentItem } from "../types";
import { api } from "../services/api";

interface PaymentModalProps {
  request: PrintRequest;
  onClose: () => void;
  onPaymentSuccess: (payment: PaymentItem) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  request,
  onClose,
  onPaymentSuccess,
}) => {
  const [method, setMethod] = useState<"card" | "upi" | "campus_wallet">("card");
  
  // Card form state
  const [cardHolder, setCardHolder] = useState<string>("Jane Student");
  const [cardNumber, setCardNumber] = useState<string>("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState<string>("12/28");
  const [cardCvv, setCardCvv] = useState<string>("123");

  // UPI state
  const [upiId, setUpiId] = useState<string>("student@okcampus");

  // Campus Wallet state
  const [campusId, setCampusId] = useState<string>("STU-884920");
  const [campusPin, setCampusPin] = useState<string>("1234");

  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PaymentItem | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [processing, onClose]);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(" ") || val;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (val.length >= 3) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setCardExpiry(val);
  };

  const handleFillDemoCard = () => {
    setCardHolder("Jane Student");
    setCardNumber("4242 4242 4242 4242");
    setCardExpiry("12/28");
    setCardCvv("123");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const payment = await api.processPayment({
        request_id: request.id,
        payment_method: method,
        card_number: cardNumber,
        card_expiry: cardExpiry,
        card_cvv: cardCvv,
        card_holder: cardHolder,
        upi_id: upiId,
        campus_id: campusId,
        campus_pin: campusPin,
      });

      setSuccessData(payment);
      onPaymentSuccess(payment);
    } catch (err: any) {
      setError(err.message || "Payment transaction could not be processed.");
    } finally {
      setProcessing(false);
    }
  };

  const totalAmount = request.total_amount ?? 3.00;
  const ratePerPage = request.rate_per_page ?? (request.color_mode === "color" ? 6.00 : 3.00);
  const totalPages = request.total_pages ?? request.copies;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
    >
      <div className="bg-pe-surface rounded-pe-lg max-w-lg w-full border border-pe-border shadow-pe-popover overflow-hidden space-y-0">
        {/* Header */}
        <div className="p-5 border-b border-pe-border-subtle flex items-center justify-between bg-pe-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-pe-sm bg-pe-surface-secondary border border-pe-border-subtle flex items-center justify-center text-pe-accent">
              <ShieldCheck className="w-5 h-5 text-pe-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-pe-text">Campus Payment Gateway</h2>
              <p className="text-xs text-pe-text-secondary">Official student-to-staff printing settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-pe-text-secondary hover:text-pe-text rounded-pe-sm hover:bg-pe-surface-secondary transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successData ? (
          /* Success Screen */
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#EBF7EE] text-[#248A3D] border border-[#CDEED5] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pe-text">Payment Confirmed</h3>
              <p className="text-xs text-pe-text-secondary mt-1">
                Your transaction has been settled directly to the print center workstation.
              </p>
            </div>

            <div className="bg-pe-surface-secondary rounded-pe-sm p-4 border border-pe-border-subtle text-left text-xs space-y-2 tabular-nums">
              <div className="flex justify-between py-1 border-b border-pe-border-subtle/70">
                <span className="text-pe-text-secondary">Amount Paid</span>
                <span className="font-semibold text-pe-text">₹{successData.amount.toFixed(2)} {successData.currency || "INR"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-pe-border-subtle/70">
                <span className="text-pe-text-secondary">Transaction ID</span>
                <span className="font-mono text-pe-text">{successData.transaction_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-pe-border-subtle/70">
                <span className="text-pe-text-secondary">Receipt Ref</span>
                <span className="font-mono text-pe-text">{successData.receipt_reference}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-pe-text-secondary">Method</span>
                <span className="capitalize text-pe-text font-medium">{successData.payment_method}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full min-h-[44px] px-4 py-2.5 bg-pe-accent hover:bg-pe-accent-hover text-white text-sm font-semibold rounded-pe-sm transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Payment Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Job Summary Banner */}
            <div className="p-4 bg-pe-surface-secondary/70 rounded-pe-sm border border-pe-border-subtle">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs text-pe-text-secondary">Document</span>
                  <p className="text-sm font-semibold text-pe-text truncate max-w-[260px]">
                    {request.document_name || "Document.pdf"}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-xs text-pe-text-secondary">Total Due</span>
                  <p className="text-lg font-semibold text-pe-text">
                    ₹{totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-pe-border-subtle/80 flex items-center justify-between text-xs text-pe-text-secondary tabular-nums">
                <span>
                  {totalPages} {totalPages === 1 ? "page" : "pages"} ({request.copies} {request.copies === 1 ? "copy" : "copies"})
                </span>
                <span>•</span>
                <span className="capitalize">{request.color_mode === "bw" ? "B&W" : "Color"} (₹{ratePerPage.toFixed(2)}/page)</span>
                <span>•</span>
                <span className="capitalize">{request.duplex}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-[#FDEBED] border border-[#F8C8CC] text-[#D70015] rounded-pe-sm text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-pe-text mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("card");
                    setError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-pe-sm border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                    method === "card"
                      ? "bg-pe-surface border-pe-accent text-pe-accent ring-2 ring-pe-accent/20 shadow-sm"
                      : "bg-pe-surface-secondary text-pe-text-secondary border-pe-border hover:text-pe-text"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod("upi");
                    setError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-pe-sm border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                    method === "upi"
                      ? "bg-pe-surface border-pe-accent text-pe-accent ring-2 ring-pe-accent/20 shadow-sm"
                      : "bg-pe-surface-secondary text-pe-text-secondary border-pe-border hover:text-pe-text"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod("campus_wallet");
                    setError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-pe-sm border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                    method === "campus_wallet"
                      ? "bg-pe-surface border-pe-accent text-pe-accent ring-2 ring-pe-accent/20 shadow-sm"
                      : "bg-pe-surface-secondary text-pe-text-secondary border-pe-border hover:text-pe-text"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>Campus Card</span>
                </button>
              </div>
            </div>

            {/* Method Inputs */}
            {method === "card" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-pe-text">Card Information</label>
                  <button
                    type="button"
                    onClick={handleFillDemoCard}
                    className="text-xs text-pe-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="w-3 h-3" /> Fill test card
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-pe-text-secondary mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    required
                    placeholder="Full Name as on card"
                    className="w-full min-h-[44px] px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  />
                </div>

                <div>
                  <label className="block text-xs text-pe-text-secondary mb-1">Card Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      required
                      placeholder="4242 4242 4242 4242"
                      className="w-full min-h-[44px] pl-3 pr-9 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text tabular-nums font-mono focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                    />
                    <Lock className="w-4 h-4 absolute right-3 top-3.5 text-pe-text-secondary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-pe-text-secondary mb-1">Expiration (MM/YY)</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={handleExpiryChange}
                      required
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full min-h-[44px] px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text tabular-nums font-mono focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-pe-text-secondary mb-1">Security Code (CVV)</label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      required
                      placeholder="123"
                      maxLength={4}
                      className="w-full min-h-[44px] px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text tabular-nums font-mono focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {method === "upi" && (
              <div className="space-y-3">
                <div className="p-3 bg-pe-surface-secondary rounded-pe-sm border border-pe-border-subtle flex items-center gap-3">
                  <div className="w-16 h-16 bg-white p-1 rounded border border-pe-border flex items-center justify-center">
                    <QrCode className="w-14 h-14 text-pe-text" />
                  </div>
                  <div className="text-xs text-pe-text-secondary space-y-0.5">
                    <p className="font-semibold text-pe-text">Scan & Pay via any UPI App</p>
                    <p>Google Pay, PhonePe, Paytm, or BHIM</p>
                    <p className="text-pe-accent font-medium tabular-nums">Amount: ₹{totalAmount.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-pe-text mb-1">Or enter UPI ID / VPA</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    required
                    placeholder="student@bank"
                    className="w-full min-h-[44px] px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  />
                </div>
              </div>
            )}

            {method === "campus_wallet" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-pe-text mb-1">Student / Campus Card ID</label>
                  <input
                    type="text"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    required
                    placeholder="STU-123456"
                    className="w-full min-h-[44px] px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text tabular-nums font-mono focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-pe-text mb-1">Campus Card PIN</label>
                  <input
                    type="password"
                    value={campusPin}
                    onChange={(e) => setCampusPin(e.target.value)}
                    required
                    placeholder="4-digit PIN"
                    maxLength={6}
                    className="w-full min-h-[44px] px-3 py-2 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text tabular-nums font-mono focus:outline-none focus:ring-2 focus:ring-pe-accent/20"
                  />
                </div>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={processing}
                className="w-full min-h-[44px] px-4 py-2.5 bg-pe-accent hover:bg-pe-accent-hover text-white text-sm font-semibold rounded-pe-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authorizing with Campus Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹{totalAmount.toFixed(2)} Securely</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-pe-text-secondary mt-2 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#248A3D]" />
                Direct settlement to print center workstation staff
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
