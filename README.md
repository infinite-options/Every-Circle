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

# On iPhone Simulator

- Google Login
  - may need to Reset Device using Device > Erase all Contents and Settings
  - npx expo run:ios
- Apple Login
  - may need to check Team and Apple Sign in using Xcode
