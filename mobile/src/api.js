import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const ACCESS_KEY = 'gym.accessToken';
const REFRESH_KEY = 'gym.refreshToken';

/**
 * The access token is cached here so a request never waits on the keychain.
 * SecureStore is only touched at launch, at login, and when tokens rotate.
 */
let accessToken = null;
let refreshToken = null;
let loaded = false;

/** Called when the session is gone for good, so the app can drop to the login screen. */
let onSessionExpired = () => {};
export const setOnSessionExpired = (fn) => {
  onSessionExpired = fn;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function loadTokens() {
  if (loaded) return accessToken;
  [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  loaded = true;
  return accessToken;
}

export async function saveTokens(tokens) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  loaded = true;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ]);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  loaded = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

export const getRefreshToken = () => refreshToken;
export const hasSession = () => Boolean(accessToken);

/**
 * Refresh tokens rotate, and the server treats a token used twice as theft and
 * ends every session for the account. So concurrent 401s must share one refresh
 * rather than each spending the token.
 */
let inFlightRefresh = null;

function refreshSession(staleToken) {
  // Sharing one in-flight promise is not enough on its own: a request whose 401
  // lands after that promise settled would start a second refresh and spend the
  // rotated token twice. If the token has already moved on, there is nothing to do.
  if (accessToken && accessToken !== staleToken) return Promise.resolve(accessToken);

  inFlightRefresh ??= (async () => {
    if (!refreshToken) throw new ApiError('Your session has expired.', 401);

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      onSessionExpired();
      throw new ApiError('Your session has expired.', 401);
    }

    await saveTokens(await res.json());
    return accessToken;
  })().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

async function readError(res) {
  try {
    const body = await res.json();
    // Every endpoint answers `{"detail": "one sentence"}`, ready to render.
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    /* fall through to the generic message */
  }
  return 'Something went wrong. Please try again.';
}

export async function request(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  if (!BASE_URL) {
    throw new ApiError('No API URL configured. Set EXPO_PUBLIC_API_URL in mobile/.env.', 0);
  }
  if (auth) await loadTokens();
  // Captured before the round trip so a 401 can tell "my token expired" from
  // "someone else already replaced it while I was waiting".
  const tokenUsed = accessToken;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : null),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : null),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects when the request never reached the server.
    throw new ApiError(`Can't reach the server at ${BASE_URL}.`, 0);
  }

  // 401 means the access token expired; 403 means the request was understood
  // and refused — a wrong password — and must not cost the user their session.
  if (res.status === 401 && auth && retry) {
    await refreshSession(tokenUsed);
    return request(path, { method, body, auth, retry: false });
  }

  if (res.status === 401 && auth) {
    await clearTokens();
    onSessionExpired();
  }

  if (!res.ok) throw new ApiError(await readError(res), res.status);
  return res.status === 204 ? null : res.json();
}
