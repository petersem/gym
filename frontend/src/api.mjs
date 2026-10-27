// Relative base; Vite proxies /api to the backend (see vite.config.js).
export const API_BASE_URL = "/api/v1";

// hardcode url base so we can bypass the Vite proxy during local development, and see preflight OPTIONS requests in the browser console.
//export const API_BASE_URL = "http://localhost:3000/api/v1";

/**
 * @param {"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string} method - HTTP Method
 * @param {string} route - API route starting with /
 * @param {object | null} body - Body data object
 * @param {string | null} authKey - Optional authentication key header
 * @returns {Promise<{status: number, body: any}>} Result of API fetch request
 */
export async function fetchAPI(method, route, body, authKey) {
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (authKey) {
    headers["x-auth-key"] = authKey;
  }

  try {
    const response = await fetch(API_BASE_URL + route, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const status = response.status;
    const responseBody = await response.json().catch(() => ({}));

    return {
      status,
      body: responseBody,
    };
  } catch (error) {
    throw String(error);
  }
}

/**
 * Build a query string from an object, skipping empty values.
 *
 * @param {Record<string, string | number | null | undefined>} params
 * @returns {string} e.g. "?search_term=yoga&sort_by=date" or ""
 */
export function queryString(params) {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(name, value);
    }
  }
  const text = search.toString();
  return text ? "?" + text : "";
}
