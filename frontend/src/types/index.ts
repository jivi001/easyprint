export type UserRole = "student" | "staff" | "admin";

export type RequestStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "COLLECTED"
  | "FAILED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type PaymentMethod = "card" | "upi" | "campus_wallet" | "cash";

export type ColorMode = "bw" | "color";
export type DuplexMode = "single" | "double";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  name: string;
  email: string;
  user_id: string;
}

export interface DocumentItem {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface PrintSettings {
  page_range: string;
  copies: number;
  color: string;
  duplex: string;
  orientation: string;
  paper_size: string;
}

export interface StatusHistoryItem {
  id: string;
  old_status: string;
  new_status: string;
  comment?: string;
  changed_by_name?: string;
  timestamp: string;
}

export interface PrintRequest {
  id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  document_id: string;
  document_name?: string;
  file_size?: number;
  status: RequestStatus;
  copies: number;
  color_mode: ColorMode;
  duplex: DuplexMode;
  page_range: string;
  created_at: string;
  updated_at: string;
  settings?: PrintSettings;
  status_history?: StatusHistoryItem[];
  // Payment fields
  payment_status?: PaymentStatus;
  total_amount?: number;
  currency?: string;
  rate_per_page?: number;
  total_pages?: number;
  payment_method?: string;
  transaction_id?: string;
  paid_at?: string;
}

export interface PaymentItem {
  id: string;
  request_id: string;
  student_id: string;
  student_name?: string;
  staff_id?: string;
  staff_name?: string;
  amount: number;
  currency: string;
  rate_per_page: number;
  total_pages: number;
  status: PaymentStatus;
  payment_method?: string;
  transaction_id?: string;
  gateway_provider: string;
  receipt_reference?: string;
  paid_at?: string;
  created_at: string;
}

export interface PaymentReceipt {
  receipt_number: string;
  transaction_id: string;
  paid_at: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  gateway_provider: string;
  student_name: string;
  student_email: string;
  document_name: string;
  copies: number;
  color_mode: string;
  duplex: string;
  page_range: string;
  total_pages: number;
  rate_per_page: number;
  staff_receiver_name?: string;
}

export interface PrintRateInfo {
  bw_rate_per_page: number;
  color_rate_per_page: number;
  currency: string;
  currency_symbol: string;
}

export interface PriceCalculation {
  total_pages: number;
  rate_per_page: number;
  subtotal: number;
  total_amount: number;
  currency: string;
  currency_symbol: string;
}

export interface NotificationItem {
  id: string;
  request_id?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

export interface AdminReport {
  total_users: number;
  total_students: number;
  total_staff: number;
  total_print_requests: number;
  requests_by_status: Record<string, number>;
  total_pages_printed_approx: number;
  total_documents_uploaded: number;
  total_storage_bytes: number;
  total_revenue?: number;
  total_paid_requests?: number;
  total_unpaid_requests?: number;
  revenue_by_method?: Record<string, number>;
}

export interface AuditLogItem {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  details?: Record<string, any>;
  timestamp: string;
}
