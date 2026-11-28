const API = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export async function api(path, options = {}) {
  const attempts = (options.method || "GET").toUpperCase() === "GET" ? 3 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw Object.assign(
          new Error(data.error || "Không thể hoàn tất yêu cầu."),
          { status: response.status },
        );
      return data;
    } catch (error) {
      if (error.status) throw error;
      if (attempt === attempts)
        throw new Error(
          "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.",
        );
      await new Promise((resolve) => setTimeout(resolve, attempt * 200));
    }
  }
}
export const apiBase = API;
