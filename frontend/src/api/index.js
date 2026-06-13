const BASE = 'http://localhost:3001';

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function analyzeModule1(formData) {
  const res = await fetch(`${BASE}/analyze/module1`, { method: 'POST', body: formData });
  return handleResponse(res);
}

export async function analyzeModule3(formData) {
  const res = await fetch(`${BASE}/analyze/module3`, { method: 'POST', body: formData });
  return handleResponse(res);
}

export async function saveSession(session) {
  const res = await fetch(`${BASE}/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  return handleResponse(res);
}

export async function getSessions(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await fetch(`${BASE}/journal${params ? '?' + params : ''}`);
  return handleResponse(res);
}

export async function getSession(id) {
  const res = await fetch(`${BASE}/journal/${id}`);
  return handleResponse(res);
}

export async function updateSession(id, patch) {
  const res = await fetch(`${BASE}/journal/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

export async function sendChatMessage(id, message) {
  const res = await fetch(`${BASE}/journal/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return handleResponse(res);
}
