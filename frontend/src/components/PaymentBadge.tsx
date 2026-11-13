import React from "react";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { PaymentStatus } from "../types";

interface PaymentBadgeProps {
  status?: PaymentStatus;
  amount?: number;
  currency?: string;
  className?: string;
  compact?: boolean;
}

export const PaymentBadge: React.FC<PaymentBadgeProps> = ({
  status = "UNPAID",
  amount,
  currency = "USD",
  className = "",
  compact = false,
}) => {
  const formattedAmount = amount !== undefined ? `$${amount.toFixed(2)}` : "";

  switch (status) {
    case "COMPLETED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF7EE] text-[#248A3D] border border-[#CDEED5] tabular-nums ${className}`}
          title={`Paid in full (${currency} ${formattedAmount})`}
        >
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{compact ? "Paid" : `Paid ${formattedAmount}`}</span>
        </span>
      );

    case "PENDING":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF5FF] text-[#0071E3] border border-[#BBDDFF] tabular-nums ${className}`}
          title={`Payment pending verification (${currency} ${formattedAmount})`}
        >
          <Clock className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          <span>{compact ? "Pending" : `Pending ${formattedAmount}`}</span>
        </span>
      );

    case "FAILED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FDEBED] text-[#D70015] border border-[#F8C8CC] tabular-nums ${className}`}
          title="Payment failed"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Failed</span>
        </span>
      );

    case "UNPAID":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF8E6] text-[#9A6700] border border-[#F2E5C2] tabular-nums ${className}`}
          title={`Unpaid balance: ${currency} ${formattedAmount}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#9A6700] flex-shrink-0" />
          <span>{compact ? "Unpaid" : `Unpaid ${formattedAmount}`}</span>
        </span>
      );
  }
};
