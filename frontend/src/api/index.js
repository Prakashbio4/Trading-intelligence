const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function pingHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('sipy_token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function login(username) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  return handleResponse(res);
}

export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function analyzeUnified(formData) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse(res);
}

export async function analyzeModule1(formData) {
  const res = await fetch(`${BASE}/analyze/module1`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse(res);
}

export async function analyzeModule3(formData) {
  const res = await fetch(`${BASE}/analyze/module3`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse(res);
}

export async function saveSession(session) {
  const res = await fetch(`${BASE}/journal`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(session),
  });
  return handleResponse(res);
}

export async function getSessions(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await fetch(`${BASE}/journal${params ? '?' + params : ''}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function getSession(id) {
  const res = await fetch(`${BASE}/journal/${id}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function updateSession(id, patch) {
  const res = await fetch(`${BASE}/journal/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

export async function deleteSession(id) {
  const res = await fetch(`${BASE}/journal/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function deleteSessions(ids) {
  const res = await fetch(`${BASE}/journal`, {
    method: 'DELETE',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ids }),
  });
  return handleResponse(res);
}

export async function uploadOutcomeImages(id, { entryChart, exitChart }) {
  const fd = new FormData();
  if (entryChart) fd.append('entryChart', entryChart);
  if (exitChart)  fd.append('exitChart',  exitChart);
  const res = await fetch(`${BASE}/journal/${id}/images`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  return handleResponse(res);
}

export async function sendChatMessage(id, message) {
  const res = await fetch(`${BASE}/journal/${id}/chat`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message }),
  });
  return handleResponse(res);
}

export async function getInsightsContext() {
  const res = await fetch(`${BASE}/journal/insights-context`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function sendInsightsChat(message, context, history) {
  const res = await fetch(`${BASE}/journal/insights-chat`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, context, history }),
  });
  return handleResponse(res);
}
