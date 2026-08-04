/**
 * The app's data layer. Accounts, personal records and body weight now live on
 * the API; the theme and everything PingUIn does are still on the device.
 *
 * Pings stayed local because the API has no endpoints for them. They work only
 * between accounts that have signed in on this device — the same limitation as
 * before, with a local directory (`@gym/known-users`) standing in for the
 * accounts table that moved to the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTokens, getRefreshToken, hasSession, loadTokens, request, saveTokens } from './api';

const THEME_KEY = '@gym/theme';
const SCHEMA_KEY = '@gym/schema';

/**
 * Bumped whenever stored records change shape. Version 5 drops the last of the
 * local data — pings, friends and the device account directory — now that the
 * API owns them too. The theme survives, being a device preference.
 */
const SCHEMA_VERSION = '5';

/* ---------------------------------- setup --------------------------------- */

/** Runs once before anything reads storage. Safe to call repeatedly. */
export async function initStorage() {
  await loadTokens();

  const stored = await AsyncStorage.getItem(SCHEMA_KEY);
  if (stored === SCHEMA_VERSION) return false;

  const keys = await AsyncStorage.getAllKeys();
  const stale = keys.filter((k) => k.startsWith('@gym/') && k !== THEME_KEY && k !== SCHEMA_KEY);
  if (stale.length) await AsyncStorage.multiRemove(stale);

  await AsyncStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  return true;
}

/* ---------------------------------- auth ---------------------------------- */

export async function signUp({ username, email, password }) {
  const { user, tokens } = await request('/auth/signup', {
    method: 'POST',
    auth: false,
    body: { username, email, password },
  });
  await saveTokens(tokens);
  return user;
}

export async function logIn({ email, password }) {
  const { user, tokens } = await request('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  await saveTokens(tokens);
  return user;
}

export async function logOut() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    // Best effort: the session is over locally whatever the server answers.
    await request('/auth/logout', {
      method: 'POST',
      auth: false,
      body: { refreshToken },
    }).catch(() => {});
  }
  await clearTokens();
}

export async function getCurrentUser() {
  await loadTokens();
  if (!hasSession()) return null;
  try {
    return await request('/auth/me');
  } catch {
    // An expired or rejected session means "logged out", not an error to show.
    return null;
  }
}

/* --------------------------------- account -------------------------------- */

export const changeEmail = ({ newEmail, currentPassword }) =>
  request('/account/email', { method: 'PATCH', body: { newEmail, currentPassword } });

export const changeUsername = ({ username, currentPassword }) =>
  request('/account/username', { method: 'PATCH', body: { username, currentPassword } });

export async function changePassword({ currentPassword, newPassword }) {
  // Changing it ends every other session, so this answers with a fresh pair.
  const { tokens } = await request('/account/password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
  await saveTokens(tokens);
}

/** Height, goal weight and avatar. Send only what changed — an omitted field is left alone. */
export const updateProfile = (changes) =>
  request('/account/profile', { method: 'PATCH', body: changes });

/**
 * Whether the signup questions have been dealt with. Kept on the device rather
 * than the account because skipping is a decision about this phone's flow, not
 * a fact about the user — the server only knows whether the values are set.
 */
const onboardedKey = (userId) => `@gym/onboarded/${userId}`;
export const isOnboarded = async (userId) => (await AsyncStorage.getItem(onboardedKey(userId))) === '1';
export const setOnboarded = (userId) => AsyncStorage.setItem(onboardedKey(userId), '1');

export async function deleteAccount(password) {
  await request('/account', { method: 'DELETE', body: { password } });
  await clearTokens();
}

/* ---------------------------------- theme --------------------------------- */

/** Device-wide, not per-account — the auth screen needs it before anyone logs in. */
export const getThemePreference = () => AsyncStorage.getItem(THEME_KEY);
export const setThemePreference = (key) => AsyncStorage.setItem(THEME_KEY, key);

/* ----------------------------------- PRs ---------------------------------- */

export const getPRs = () => request('/prs');

/**
 * POST is idempotent by exercise name, so this both creates and updates, and it
 * answers with the saved record — enough for the caller to update its own list
 * without asking for the whole thing again.
 */
export const savePR = ({ exercise, weight }) =>
  request('/prs', { method: 'POST', body: { exercise, weight } });

export const deletePR = (recordId) => request(`/prs/${recordId}`, { method: 'DELETE' });

/* --------------------------------- weight --------------------------------- */

/** The screen reads `date` as a timestamp; the wire calls it `recordedAt`. */
const toEntry = ({ id, kg, recordedAt }) => ({ id, kg, date: Date.parse(recordedAt) });

export async function getWeights() {
  const entries = await request('/weights');
  return entries.map(toEntry);
}

export async function addWeight(kg) {
  return toEntry(await request('/weights', { method: 'POST', body: { kg } }));
}

export const deleteWeight = (entryId) => request(`/weights/${entryId}`, { method: 'DELETE' });

/* ---------------------------------- pings --------------------------------- */

/**
 * `user` on a ping is whoever the viewer isn't, so the same shape draws a row in
 * either tab. `at` arrives as ISO and is parsed here, the way weights are.
 */
const toPing = ({ id, user, at, status, sentAt, respondedAt }) => ({
  id,
  user,
  at: Date.parse(at),
  status,
  sentAt: Date.parse(sentAt),
  respondedAt: respondedAt ? Date.parse(respondedAt) : null,
});

export async function getReceivedPings() {
  return (await request('/pings/received')).map(toPing);
}

export async function getSentPings() {
  return (await request('/pings/sent')).map(toPing);
}

/** By username — what the sender typed, and what identifies one account. */
export async function sendPing({ username, at }) {
  return toPing(
    await request('/pings', {
      method: 'POST',
      body: { username, at: new Date(at).toISOString() },
    })
  );
}

/** Only the recipient can answer, and they may change their answer. */
export async function respondToPing(pingId, status) {
  return toPing(await request(`/pings/${pingId}`, { method: 'PATCH', body: { status } }));
}

/** The sender withdrawing. A recipient declines instead. */
export const cancelPing = (pingId) => request(`/pings/${pingId}`, { method: 'DELETE' });
