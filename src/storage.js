import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const USERS_KEY = '@gym/users';
const SESSION_KEY = '@gym/session';
const prsKey = (userId) => `@gym/prs/${userId}`;
const weightsKey = (userId) => `@gym/weights/${userId}`;

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

async function hashPassword(password, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

/* ---------------------------------- auth ---------------------------------- */

export async function signUp({ name, email, password }) {
  const users = await readJSON(USERS_KEY, []);
  const cleanEmail = normalizeEmail(email);

  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const salt = newId();
  const user = {
    id: newId(),
    name: name.trim(),
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

const publicUser = ({ id, name, email }) => ({ id, name, email });

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
