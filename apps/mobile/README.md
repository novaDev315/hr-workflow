# HRFlow Pro Mobile App

Employee mobile application built with React Native and Expo SDK 53.

## Features

- GPS-based clock in/out with location verification
- Attendance history tracking
- Leave application and management
- Leave balance viewing
- Payslip viewing and download
- Employee profile management
- Push notifications (to be implemented)

## Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator

## Installation

```bash
npm install
```

## Running the App

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
EXPO_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

## Project Structure

```
apps/mobile/
├── app/              # Expo Router pages
│   ├── (auth)/      # Authentication screens
│   ├── (tabs)/      # Tab navigation screens
│   └── _layout.tsx
├── src/
│   └── lib/         # Utilities and configurations
├── assets/          # Images, fonts, etc.
└── app.json         # Expo configuration
```

## Features to Implement

- GraphQL integration for all screens
- Camera integration for attendance photos
- GPS location services
- Push notifications
- Offline support
- Biometric authentication
