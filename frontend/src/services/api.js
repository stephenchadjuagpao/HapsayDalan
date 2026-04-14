import axios from "axios";

const browserHostname =
  typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const browserProtocol =
  typeof window !== "undefined" && window.location.protocol
    ? window.location.protocol
    : "http:";

const defaultBaseURL = `${browserProtocol}//${browserHostname}:8000/api/`;

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || defaultBaseURL,
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFTOKEN",
});

export default API;
