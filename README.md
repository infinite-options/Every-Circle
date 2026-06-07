# Every-Circle-Mobile

# Minimum when switching Credentials

rm -rf android or rm -rf ios
npx expo start --reset-cache
npx expo prebuild --clean (clean may reset Xcode settings like Team and Apple SignIn)
npx expo run

This might be cleaner (and less distruptive):
rm -rf android  
 npx expo prebuild  
 npx expo run:android

NOTE: npx expo prebuild --clean is equivalent to rm -rf ios android & npx expo prebuild

## API encryption (matches myspace-web / myspace-backend)

Set:

```bash
EXPO_PUBLIC_ENCRYPTION_ON=false   # local backend at http://127.0.0.1:4090, plain JSON requests
EXPO_PUBLIC_ENCRYPTION_ON=true    # AWS dev API, encrypted POST/PUT bodies
```

- **Outgoing** JSON and FormData are encrypted only when `EXPO_PUBLIC_ENCRYPTION_ON=true` **and** the request URL is under `AWS_DEV_API_BASE_URL` (`o7t5ikn907...`). Auth, Stripe, and search endpoints stay plain JSON.
- **Incoming** responses are always decrypted when the backend returns `{ "encrypted_data": "..." }` (even when the env flag is false).
- Add header `Postman-Secret: postmansecret` to skip request encryption (matches backend Postman bypass).
- AES key: `IO95120secretkey` (must match backend `AES_SECRET_KEY`).
- Restart Metro after changing `.env` (`npx expo start --clear`).
- AWS API calls require a JWT. The auth login Lambda does not return one for EVERY-CIRCLE yet; the app bootstraps JWT via `POST /auth/accessToken` on the ec_api backend when encryption mode is on. **Redeploy Every-Circle-Backend** after pulling the latest `ec_api.py`. Reload the app (or log out/in) so tokens are fetched on startup.

All `fetch` calls are patched via `installHttpEncryption()` in `index.js`. Axios call sites import `axiosMiddleware` from `utils/httpMiddleware.js`.

# On iPhone Simulator

- Google Login
  - may need to Reset Device using Device > Erase all Contents and Settings
  - npx expo run:ios
- Apple Login
  - may need to check Team and Apple Sign in using Xcode
