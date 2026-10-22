const SESSION_KEY = 'monera_jwt_session';

export function getStoredToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    return undefined;
  }
}

export async function apiRequest(endpoint, { method = 'GET', body, headers = {} } = {}) {
  const token = getStoredToken();
  const reqHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  const config = {
    method,
    headers: reqHeaders,
    credentials: 'include',
  };

  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Une erreur réseau est survenue.');
    error.status = response.status;
    throw error;
  }

  return data;
}
