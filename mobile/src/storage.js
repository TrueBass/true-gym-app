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
const KNOWN_USERS_KEY = '@gym/known-users';
const friendsKey = (userId) => `@gym/friends/${userId}`;
const pingsKey = (userId) => `@gym/pings/${userId}`;
const inboxKey = (userId) => `@gym/inbox/${userId}`;

/**
 * Bumped whenever stored records change shape. Version 4 drops the local
 * accounts, records and weights the API now owns; the theme survives, being a
 * device preference rather than data.
 */
const SCHEMA_VERSION = '4';

async function readJSON(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const writeJSON = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const cleanUsername = (username) => String(username ?? '').trim().replace(/^@+/, '');
const usernameKey = (username) => cleanUsername(username).toLowerCase();

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

/** Local directory of accounts seen on this device — all PingUIn has to go on. */
async function rememberUser(user) {
  const known = await readJSON(KNOWN_USERS_KEY, []);
  await writeJSON(KNOWN_USERS_KEY, [user, ...known.filter((u) => u.id !== user.id)]);
  return user;
}

export async function signUp({ username, email, password }) {
  const { user, tokens } = await request('/auth/signup', {
    method: 'POST',
    auth: false,
    body: { username, email, password },
  });
  await saveTokens(tokens);
  return rememberUser(user);
}

export async function logIn({ email, password }) {
  const { user, tokens } = await request('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  await saveTokens(tokens);
  return rememberUser(user);
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
  request('/account/email', { method: 'PATCH', body: { newEmail, currentPassword } }).then(
    rememberUser
  );

export const changeUsername = ({ username, currentPassword }) =>
  request('/account/username', { method: 'PATCH', body: { username, currentPassword } }).then(
    rememberUser
  );

export async function changePassword({ currentPassword, newPassword }) {
  // Changing it ends every other session, so this answers with a fresh pair.
  const { tokens } = await request('/account/password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
  await saveTokens(tokens);
}

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

export async function findUserByUsername(username) {
  const known = await readJSON(KNOWN_USERS_KEY, []);
  return known.find((u) => usernameKey(u.username) === usernameKey(username)) ?? null;
}

/** People this user has pinged before, most recent first. */
export const getFriends = (userId) => readJSON(friendsKey(userId), []);

/** Pings this user has sent. */
export const getPings = (userId) => readJSON(pingsKey(userId), []);

/** Pings sent to this user. */
export const getInbox = (userId) => readJSON(inboxKey(userId), []);

export async function sendPing(userId, { username, at }) {
  const target = cleanUsername(username);
  if (!target) throw new Error('Enter a username.');
  if (!Number.isFinite(at)) throw new Error('Pick a date and time.');

  const recipient = await findUserByUsername(target);
  if (!recipient) throw new Error(`No user called @${target} on this device.`);
  if (recipient.id === userId) throw new Error("You can't ping yourself.");

  const sender = (await readJSON(KNOWN_USERS_KEY, [])).find((u) => u.id === userId);
  if (!sender) throw new Error('Account not found.');

  const [friends, sent, inbox] = await Promise.all([
    getFriends(userId),
    getPings(userId),
    getInbox(recipient.id),
  ]);

  const existing = friends.find((f) => usernameKey(f.username) === usernameKey(recipient.username));
  const nextFriends = [
    {
      id: existing?.id ?? newId(),
      userId: recipient.id,
      username: recipient.username,
      pingCount: (existing?.pingCount ?? 0) + 1,
      lastPingedAt: Date.now(),
    },
    ...friends.filter((f) => f.id !== existing?.id),
  ];

  const sentAt = Date.now();
  // Both copies carry the same pingId so a response can be mirrored back.
  const pingId = newId();
  const ping = {
    id: newId(),
    pingId,
    toUserId: recipient.id,
    username: recipient.username,
    at,
    sentAt,
    status: 'pending',
  };
  const received = {
    id: newId(),
    pingId,
    fromUserId: userId,
    fromUsername: sender.username,
    at,
    sentAt,
    status: 'pending',
  };

  const nextSent = [ping, ...sent];

  await Promise.all([
    writeJSON(friendsKey(userId), nextFriends),
    writeJSON(pingsKey(userId), nextSent),
    writeJSON(inboxKey(recipient.id), [received, ...inbox]),
  ]);

  return { ping, friends: nextFriends, pings: nextSent, recipient };
}

export async function deletePing(userId, pingId) {
  const next = (await getPings(userId)).filter((p) => p.id !== pingId);
  await writeJSON(pingsKey(userId), next);
  return next;
}

export const PING_RESPONSES = ['accepted', 'declined'];

/**
 * Answers a ping in this user's inbox and mirrors the answer onto the sender's
 * copy, so they can see it in their Sent list.
 */
export async function respondToPing(userId, inboxId, status) {
  if (!PING_RESPONSES.includes(status)) throw new Error('Unknown response.');

  const inbox = await getInbox(userId);
  const entry = inbox.find((p) => p.id === inboxId);
  if (!entry) throw new Error('Ping not found.');

  const respondedAt = Date.now();
  const nextInbox = inbox.map((p) => (p.id === inboxId ? { ...p, status, respondedAt } : p));
  const writes = [writeJSON(inboxKey(userId), nextInbox)];

  if (entry.pingId) {
    const sent = await getPings(entry.fromUserId);
    if (sent.some((p) => p.pingId === entry.pingId)) {
      writes.push(
        writeJSON(
          pingsKey(entry.fromUserId),
          sent.map((p) => (p.pingId === entry.pingId ? { ...p, status, respondedAt } : p))
        )
      );
    }
  }

  await Promise.all(writes);
  return nextInbox;
}

export async function removeFriend(userId, friendId) {
  const next = (await getFriends(userId)).filter((f) => f.id !== friendId);
  await writeJSON(friendsKey(userId), next);
  return next;
}
