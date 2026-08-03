import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const USERS_KEY = '@gym/users';
const SESSION_KEY = '@gym/session';
const THEME_KEY = '@gym/theme';
const SCHEMA_KEY = '@gym/schema';

/**
 * Bumped whenever stored records change shape. On a mismatch every `@gym/*` key
 * is dropped rather than migrated — this is a local-only app with no data worth
 * preserving across a breaking change, and a stale record is worse than none.
 * The theme survives, being a device preference rather than data.
 */
const SCHEMA_VERSION = '3';
const prsKey = (userId) => `@gym/prs/${userId}`;
const weightsKey = (userId) => `@gym/weights/${userId}`;
const friendsKey = (userId) => `@gym/friends/${userId}`;
const pingsKey = (userId) => `@gym/pings/${userId}`;
const inboxKey = (userId) => `@gym/inbox/${userId}`;

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

const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * The username is the handle friends ping, so it has to be unique. Displayed as
 * typed, compared case-insensitively, and tolerant of a leading @.
 */
const cleanUsername = (username) => String(username ?? '').trim().replace(/^@+/, '');
const usernameKey = (username) => cleanUsername(username).toLowerCase();

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

function assertUsername(username) {
  const clean = cleanUsername(username);
  if (!USERNAME_RE.test(clean)) {
    throw new Error('Usernames are 3-20 characters: letters, numbers, dot, dash or underscore.');
  }
  return clean;
}

async function hashPassword(password, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

/* ---------------------------------- setup --------------------------------- */

/** Runs once before anything reads storage. Safe to call repeatedly. */
export async function initStorage() {
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
  const users = await readJSON(USERS_KEY, []);
  const cleanEmail = normalizeEmail(email);
  const cleanedUsername = assertUsername(username);

  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error('An account with that email already exists.');
  }
  if (users.some((u) => usernameKey(u.username) === usernameKey(cleanedUsername))) {
    throw new Error('That username is taken.');
  }

  const salt = newId();
  const user = {
    id: newId(),
    username: cleanedUsername,
    email: cleanEmail,
    salt,
    hash: await hashPassword(password, salt),
  };

  await writeJSON(USERS_KEY, [...users, user]);
  await AsyncStorage.setItem(SESSION_KEY, user.id);
  return publicUser(user);
}

export async function logIn({ email, password }) {
  const users = await readJSON(USERS_KEY, []);
  const user = users.find((u) => u.email === normalizeEmail(email));

  // Same message either way so the form can't be used to probe for accounts.
  const invalid = new Error('Incorrect email or password.');
  if (!user) throw invalid;
  if ((await hashPassword(password, user.salt)) !== user.hash) throw invalid;

  await AsyncStorage.setItem(SESSION_KEY, user.id);
  return publicUser(user);
}

export async function logOut() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getCurrentUser() {
  const id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const users = await readJSON(USERS_KEY, []);
  const user = users.find((u) => u.id === id);
  return user ? publicUser(user) : null;
}

const publicUser = ({ id, username, email }) => ({ id, username, email });

/* ---------------------------------- theme --------------------------------- */

/** Device-wide, not per-account — the auth screen needs it before anyone logs in. */
export const getThemePreference = () => AsyncStorage.getItem(THEME_KEY);
export const setThemePreference = (key) => AsyncStorage.setItem(THEME_KEY, key);

/* --------------------------------- account -------------------------------- */

/** Loads the stored user record and verifies `password` before any change to it. */
async function authorize(userId, password) {
  const users = await readJSON(USERS_KEY, []);
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error('Account not found.');
  if ((await hashPassword(password, user.salt)) !== user.hash) {
    throw new Error('Current password is incorrect.');
  }
  return { users, user };
}

export async function changeEmail(userId, { newEmail, currentPassword }) {
  const { users, user } = await authorize(userId, currentPassword);
  const cleanEmail = normalizeEmail(newEmail);

  if (cleanEmail === user.email) throw new Error('That is already your email.');
  if (users.some((u) => u.id !== userId && u.email === cleanEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const updated = { ...user, email: cleanEmail };
  await writeJSON(USERS_KEY, users.map((u) => (u.id === userId ? updated : u)));
  return publicUser(updated);
}

export async function changeUsername(userId, { username, currentPassword }) {
  const { users, user } = await authorize(userId, currentPassword);
  const cleanedUsername = assertUsername(username);

  if (users.some((u) => u.id !== userId && usernameKey(u.username) === usernameKey(cleanedUsername))) {
    throw new Error('That username is taken.');
  }

  const updated = { ...user, username: cleanedUsername };
  await writeJSON(USERS_KEY, users.map((u) => (u.id === userId ? updated : u)));
  return publicUser(updated);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const { users, user } = await authorize(userId, currentPassword);

  // New salt per change, so the stored hash never repeats even for a reused password.
  const salt = newId();
  const updated = { ...user, salt, hash: await hashPassword(newPassword, salt) };
  await writeJSON(USERS_KEY, users.map((u) => (u.id === userId ? updated : u)));
}

/** Removes the account plus everything it owns, then ends the session. */
export async function deleteAccount(userId, password) {
  const { users } = await authorize(userId, password);

  await writeJSON(USERS_KEY, users.filter((u) => u.id !== userId));
  await AsyncStorage.multiRemove([
    prsKey(userId),
    weightsKey(userId),
    friendsKey(userId),
    pingsKey(userId),
    inboxKey(userId),
    SESSION_KEY,
  ]);
}

/* ----------------------------------- PRs ---------------------------------- */

export const getPRs = (userId) => readJSON(prsKey(userId), []);

export async function savePR(userId, { exercise, weight }) {
  const prs = await getPRs(userId);
  const clean = exercise.trim();
  const existing = prs.find((pr) => pr.exercise.toLowerCase() === clean.toLowerCase());

  const next = existing
    ? prs.map((pr) =>
        pr.id === existing.id ? { ...pr, exercise: clean, weight, updatedAt: Date.now() } : pr
      )
    : [{ id: newId(), exercise: clean, weight, updatedAt: Date.now() }, ...prs];

  await writeJSON(prsKey(userId), next);
  return next;
}

export async function deletePR(userId, prId) {
  const next = (await getPRs(userId)).filter((pr) => pr.id !== prId);
  await writeJSON(prsKey(userId), next);
  return next;
}

/* --------------------------------- weight --------------------------------- */

export const getWeights = (userId) => readJSON(weightsKey(userId), []);

/** Entries are kept newest-first so screens can read index 0 as "latest". */
export async function addWeight(userId, kg) {
  const entries = await getWeights(userId);
  const next = [{ id: newId(), kg, date: Date.now() }, ...entries].sort((a, b) => b.date - a.date);
  await writeJSON(weightsKey(userId), next);
  return next;
}

export async function deleteWeight(userId, entryId) {
  const next = (await getWeights(userId)).filter((e) => e.id !== entryId);
  await writeJSON(weightsKey(userId), next);
  return next;
}

/* ---------------------------------- pings --------------------------------- */

/**
 * Pings are internal: a username must belong to a real account or the ping
 * cannot be sent. Since there is no server, "real account" means an account on
 * this device — delivery writes straight into the recipient's inbox.
 */
export async function findUserByUsername(username) {
  const users = await readJSON(USERS_KEY, []);
  const match = users.find((u) => usernameKey(u.username) === usernameKey(username));
  return match ? publicUser(match) : null;
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
  if (!recipient) throw new Error(`No user called @${target}.`);
  if (recipient.id === userId) throw new Error("You can't ping yourself.");

  const sender = (await readJSON(USERS_KEY, [])).find((u) => u.id === userId);
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
  const nextInbox = [received, ...inbox];

  await Promise.all([
    writeJSON(friendsKey(userId), nextFriends),
    writeJSON(pingsKey(userId), nextSent),
    writeJSON(inboxKey(recipient.id), nextInbox),
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
 * copy, so they can see it in their Sent list. Pings written before responses
 * existed have no `pingId` to match on — those update the inbox side only.
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
