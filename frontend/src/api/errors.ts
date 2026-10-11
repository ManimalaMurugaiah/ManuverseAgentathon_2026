import axios from "axios";

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const responseData: unknown = error.response?.data;
  if (
    responseData
    && typeof responseData === "object"
    && "detail" in responseData
    && typeof responseData.detail === "string"
  ) {
    return responseData.detail;
  }

  if (!error.response) return "Cannot connect to the server. Check that the backend is running.";
  return fallback;
}
