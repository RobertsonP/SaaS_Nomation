# Development Tools & Test Scripts

This directory contains development utilities and test scripts used during the implementation of various features.

## Authentication Testing Scripts

### `test-tts-auth.js`
Standalone TTS authentication test script with visual browser mode. 
- Tests TTS login process step by step
- Captures screenshots for debugging
- Verifies authentication success

### `test-integrated-auth-flow.js`
Tests the integrated authentication flow using the API endpoints.
- Tests `/api/templates/auth` endpoint
- Tests `/api/auth-flows/test` endpoint
- Verifies UnifiedAuthService integration

### `test-unified-auth-service.js`
Direct testing of UnifiedAuthService functionality.
- Tests TTS-specific manual navigation
- Verifies authentication patterns
- Confirms browser session management

### `test-auth-api-endpoint.js`
API endpoint testing utility.
- Tests authentication API endpoints
- Verifies response formats
- Confirms error handling

### `test-tts-with-database-auth.js`
Database integration testing for TTS authentication.
- Tests with stored auth flows
- Verifies database credential handling
- Tests end-to-end flow with database

### `test-selector-quality.js`
Element selector quality testing utility.
- Tests selector generation
- Verifies uniqueness
- Quality scoring validation

## Usage

These scripts are for development and debugging purposes. They require:
- Node.js environment
- Backend server running (for API tests)
- Valid TTS credentials (for authentication tests)

## Note

These files are excluded from git commits via `.gitignore` to keep the main codebase clean.