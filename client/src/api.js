// api: every call sends the HttpOnly token cookie, nothing is read from localStorage

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'include', // sends the "token" cookie
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error((data && (data.message || data.error)) || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = data && data.details ? data.details : null;
    throw error;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body === undefined ? {} : body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

export default api;
