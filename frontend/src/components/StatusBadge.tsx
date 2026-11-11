import React from "react";
import { RequestStatus } from "../types";
import { Clock, Play, CheckCircle2, PackageCheck, AlertCircle, XCircle } from "lucide-react";

interface Props {
  status: RequestStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<
  RequestStatus,
  { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    bg: "bg-[#FFF8E6] border-[#F2E5C2]",
    text: "text-[#7A5200]",
    dot: "bg-[#7A5200]",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  PROCESSING: {
    label: "Processing",
    bg: "bg-[#EBF5FF] border-[#CCE4FF]",
    text: "text-[#005BB5]",
    dot: "bg-[#005BB5]",
    icon: <Play className="w-3.5 h-3.5 fill-current" />,
  },
  READY: {
    label: "Ready for pickup",
    bg: "bg-[#EBF7EE] border-[#CDEED5]",
    text: "text-[#1B7029]",
    dot: "bg-[#1B7029]",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  COLLECTED: {
    label: "Collected",
    bg: "bg-[#F2F2F4] border-[#E5E5EA]",
    text: "text-[#3A3A3C]",
    dot: "bg-[#3A3A3C]",
    icon: <PackageCheck className="w-3.5 h-3.5" />,
  },
  FAILED: {
    label: "Failed",
    bg: "bg-[#FDEBED] border-[#F8C8CC]",
    text: "text-[#B80012]",
    dot: "bg-[#B80012]",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-[#F2F2F4] border-[#E5E5EA]",
    text: "text-[#3A3A3C]",
    dot: "bg-[#6E6E73]",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

export const StatusBadge: React.FC<Props> = ({ status, size = "md" }) => {
  const config = statusConfig[status] || {
    label: status,
    bg: "bg-[#F2F2F4] border-[#E5E5EA]",
    text: "text-[#3A3A3C]",
    dot: "bg-[#3A3A3C]",
    icon: <Clock className="w-3.5 h-3.5" />,
  };

  const sizeClasses =
    size === "sm"
      ? "text-xs px-2.5 py-0.5 gap-1.5 font-semibold"
      : "text-xs font-semibold px-3 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bg} ${config.text} ${sizeClasses}`}
    >
      <span className="flex-shrink-0">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};
