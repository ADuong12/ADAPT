// Tiny shared fetch wrapper. Reads the JWT token from localStorage
// (set by login.html) and adds the Authorization Bearer header automatically.

const DEFAULT_API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:3000" : "";
const API_BASE = (window.ADAPT_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function authToken() {
  return localStorage.getItem("authToken");
}

function teacherId() {
  const v = localStorage.getItem("teacherId");
  return v ? Number(v) : null;
}

function teacherRole() {
  return localStorage.getItem("teacherRole") || "teacher";
}

function requireLogin() {
  if (!authToken()) {
    window.location.href = "login.html";
  }
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = authToken();
  const finalHeaders = { "Content-Type": "application/json", ...headers };
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.error || data.detail || detail;
    } catch {}
    const err = new Error(`${res.status} ${detail}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

window.ADAPT_API = {
  url: apiUrl,
  authToken,
  teacherId,
  teacherRole,
  requireLogin,
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body }),
  put: (p, body) => request(p, { method: "PUT", body }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
};
