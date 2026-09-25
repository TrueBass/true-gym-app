# Expo HAS CHANGED

This project is pinned to **Expo SDK 57** so it runs in Expo Go on iOS.
Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

Do not upgrade `expo` past `~57.x` without asking — Expo Go on the target iPhone
tracks one SDK at a time, and the app has to match whatever that build supports.

Version numbers come from `npx expo install --fix`, never from npm's latest:
every `expo-*` package now carries the SDK's own version (`expo-blur@~57.0.3`),
and `react`/`react-native` are pinned exactly.
