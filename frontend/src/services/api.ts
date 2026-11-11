import {
  AuthResponse,
  User,
  DocumentItem,
  PrintRequest,
  NotificationListResponse,
  NotificationItem,
  AdminReport,
  AuditLogItem,
  RequestStatus,
  ColorMode,
  DuplexMode,
} from "../types";

const API_BASE = "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("printeasy_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        errorDetail = data.detail;
      } else if (data.detail && data.detail.message) {
        errorDetail = data.detail.message;
      }
    } catch (_) {
      errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Authentication
  async register(payload: { email: string; password: string; name: string; role?: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<User>(res);
  },

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<AuthResponse>(res);
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: getAuthHeader(),
    });
    return handleResponse<User>(res);
  },

  // Documents
  async uploadDocument(file: File): Promise<{ id: string; file_name: string; file_size: number; message: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: "POST",
      headers: getAuthHeader(),
      body: formData,
    });
    return handleResponse(res);
  },

  async listDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents`, {
      headers: getAuthHeader(),
    });
    return handleResponse<DocumentItem[]>(res);
  },

  async downloadDocument(documentId: string, filename: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      throw new Error(`Failed to download document: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Print Requests
  async createPrintRequest(payload: {
    document_id: string;
    copies: number;
    color_mode: ColorMode;
    duplex: DuplexMode;
    page_range: string;
    orientation?: string;
    paper_size?: string;
  }): Promise<PrintRequest> {
    const res = await fetch(`${API_BASE}/print-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<PrintRequest>(res);
  },

  async listPrintRequests(statusFilter?: RequestStatus): Promise<PrintRequest[]> {
    let url = `${API_BASE}/print-requests?limit=100`;
    if (statusFilter) {
      url += `&status=${encodeURIComponent(statusFilter)}`;
    }
    const res = await fetch(url, {
      headers: getAuthHeader(),
    });
    return handleResponse<PrintRequest[]>(res);
  },

  async getPrintRequest(id: string): Promise<PrintRequest> {
    const res = await fetch(`${API_BASE}/print-requests/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse<PrintRequest>(res);
  },

  async updateRequestStatus(id: string, status: RequestStatus, comment?: string): Promise<PrintRequest> {
    const res = await fetch(`${API_BASE}/print-requests/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ status, comment }),
    });
    return handleResponse<PrintRequest>(res);
  },

  // Notifications
  async getNotifications(unreadOnly = false): Promise<NotificationListResponse> {
    const res = await fetch(`${API_BASE}/notifications?unread_only=${unreadOnly}`, {
      headers: getAuthHeader(),
    });
    return handleResponse<NotificationListResponse>(res);
  },

  async markNotificationRead(id: string): Promise<NotificationItem> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeader(),
    });
    return handleResponse<NotificationItem>(res);
  },

  async markAllNotificationsRead(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    return handleResponse<{ message: string }>(res);
  },

  // Admin & Reporting
  async getAdminReports(): Promise<AdminReport> {
    const res = await fetch(`${API_BASE}/admin/reports`, {
      headers: getAuthHeader(),
    });
    return handleResponse<AdminReport>(res);
  },

  async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: getAuthHeader(),
    });
    return handleResponse<AuditLogItem[]>(res);
  },

  async listUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: getAuthHeader(),
    });
    return handleResponse<User[]>(res);
  },

  async updateUserRole(userId: string, role: string, isActive?: boolean): Promise<User> {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ role, is_active: isActive }),
    });
    return handleResponse<User>(res);
  },
};
