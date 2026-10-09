import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1",
});

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original || original._retry || error.response?.status !== 401) {
      throw error;
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      throw error;
    }

    original._retry = true;
    try {
      const { data } = await refreshClient.post<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        refresh_token: refreshToken,
      });

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api.request(original);
    } catch (refreshError) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      throw refreshError;
    }
  },
);

export default api;
