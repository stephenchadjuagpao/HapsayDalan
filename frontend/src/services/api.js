import axios from "axios";
import { rateLimitMessage } from "../utils/rateLimitMessage";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "/api/",
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFTOKEN",
});

// Django keeps the CSRF cookie HttpOnly, so Axios cannot read it. Fetch the
// masked token from Django for each write (login also rotates the cookie).
API.interceptors.request.use(async (config) => {
  if (["post", "put", "patch", "delete"].includes(String(config.method).toLowerCase())) {
    const response = await API.get("csrf/");
    const token = response.data?.csrfToken;
    if (!token) throw new Error("Could not verify this session. Refresh the page and try again.");
    config.headers = config.headers || {};
    config.headers["X-CSRFToken"] = token;
  }
  return config;
});

API.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 429) {
    error.response.data = { ...error.response.data, detail: rateLimitMessage(error) };
  }
  return Promise.reject(error);
});

export default API;
