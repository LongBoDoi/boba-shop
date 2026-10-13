# Dependency health

Expo SDK 57 is aligned to the compatible package versions reported by `npx expo install --check` and `npx expo-doctor`. Keep the SDK-compatible versions when updating dependencies.

The `xcode@3.0.1` dependency is scoped to `uuid@11.1.1` through an npm override. This removes the [UUID buffer bounds advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) and its deprecated UUID version. Xcode uses the supported CommonJS `uuid.v4()` API; project ID generation is checked with the overridden version. Remove this override when Xcode updates its own dependency to a patched version.

As of October 13, 2026, `npm audit` still reports 18 high-severity entries stemming from two upstream packages used by Expo's tooling:

- [braces: recursive pattern parsing](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), latest published version `3.0.3`, no published fix.
- [node-forge: signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv), latest published version `1.4.0`, no published fix.

The entries include packages that depend on these two libraries; they do not represent 18 separate underlying advisories. They have not been suppressed. Recheck for patched releases before the next dependency upgrade. `npm audit fix --force` currently proposes downgrading Expo and React Native to incompatible older versions and must not be used to resolve these alerts.
