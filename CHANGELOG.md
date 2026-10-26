# Changelog

## 0.1.0 — SoftwareX reproduction preparation (unreleased)

- Created a clean-history source snapshot preserving the original MIT license and attribution.
- Removed the original SQL dump and 144 MB `initialize.zip` from the distribution.
- Replaced device-identifying metadata with synthetic sensors and reproducible two-floor demo GLBs.
- Added seeded salted demo-user authentication, generated env secrets, restricted CORS and localhost ports.
- Moved MQTT listener to application startup/shutdown; added local Mosquitto + example publisher.
- Removed the 20-row hardcoded history cap (optional configurable retention).
- Made external AI key optional, with safe error responses; disabled unverified LSTM inference by default.
- Centralized frontend API configuration and added resource cleanup for the 3D renderer.
- Added smoke tests, GitHub Actions source/build checks, and software architecture documentation.

This is a modified derivative of `pittakis/digitalTwin` at commit `bfae6753b101ca297c235c6a9cc826ec55e45663`. The clean history is a packaging choice, not an assertion of sole authorship.
