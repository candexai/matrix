import axios, { AxiosError, AxiosInstance } from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

function normalizeError(err: unknown): ApiError {
  const e = err as AxiosError<{ success?: boolean; error?: ApiError }>;
  if (e?.response?.data?.error) return { ...e.response.data.error, status: e.response.status };
  if (e?.code === "ERR_NETWORK" || e?.message?.includes("Network Error")) {
    return { code: "NETWORK", message: `Cannot reach the backend at ${API_URL}. Is it running?` };
  }
  return { code: "UNKNOWN", message: (e as Error)?.message || "Request failed", status: e?.response?.status };
}

class ApiClient {
  private http: AxiosInstance;
  constructor() {
    this.http = axios.create({ baseURL: API_URL, timeout: 120000, headers: { "Content-Type": "application/json" }, withCredentials: true });
    this.http.interceptors.response.use(
      (r) => r,
      (err) => {
        const status = (err as AxiosError)?.response?.status;
        if (status === 401 && typeof window !== "undefined") {
          const path = window.location.pathname;
          const isAuthPage = path === "/login" || path === "/signup";
          const isAuthCall = String((err as AxiosError)?.config?.url ?? "").includes("/auth/");
          if (!isAuthPage && !isAuthCall) {
            window.location.href = `/login?next=${encodeURIComponent(path + window.location.search)}`;
          }
        }
        return Promise.reject(normalizeError(err));
      }
    );
  }
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await this.http.get(url, { params });
    return data.data as T;
  }
  async post<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.http.post(url, body);
    return data.data as T;
  }
  async patch<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.http.patch(url, body);
    return data.data as T;
  }
  async put<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.http.put(url, body);
    return data.data as T;
  }
  async delete<T>(url: string, params?: Record<string, unknown>, body?: unknown): Promise<T> {
    const { data } = await this.http.delete(url, { params, data: body });
    return data.data as T;
  }
}

export const api = new ApiClient();

export function errorMessage(err: unknown): string {
  const e = err as ApiError;
  return e?.message || "Something went wrong";
}

/** Absolute URL for streaming endpoints (audio). */
export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
