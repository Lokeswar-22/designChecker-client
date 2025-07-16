# JWT Authentication System

This document describes the JWT-based authentication system implemented in the Angular application.

## Overview

The authentication system provides secure JWT-based authentication with access and refresh tokens, automatic token refresh, and secure token storage with "Remember Me" functionality.

## Features

- **JWT Authentication**: Secure token-based authentication
- **Access & Refresh Tokens**: Short-lived access tokens with refresh capability
- **Automatic Token Refresh**: Seamless token renewal on 401 responses
- **Remember Me**: Option to persist tokens across browser sessions
- **Route Protection**: AuthGuard protects routes requiring authentication
- **Secure Storage**: Tokens stored in localStorage/sessionStorage based on user preference
- **Token Validation**: JWT validation and expiration checking
- **Centralized Management**: AuthService handles all authentication logic

## Architecture

### Services

#### AuthService (`src/app/services/auth.service.ts`)
- Handles login, logout, and token refresh
- Manages authentication state with BehaviorSubjects
- Provides JWT validation and decoding
- Auto-refresh tokens when expiring soon

#### LocalService (`src/app/services/local.service.ts`)
- Secure token storage in localStorage/sessionStorage
- Supports "Remember Me" functionality
- Token expiration checking
- User data management

### Interceptors

#### AuthInterceptor (`src/app/interceptors/auth.interceptor.ts`)
- Automatically attaches access tokens to HTTP requests
- Handles 401 responses with automatic token refresh
- Prevents multiple simultaneous refresh requests
- Skips token attachment for auth endpoints

### Guards

#### AuthGuard (`src/app/guards/auth.guard.ts`)
- Protects routes requiring authentication
- Validates JWT tokens before allowing access
- Redirects to login page if not authenticated

## API Endpoints

The system expects the following backend endpoints:

### Login
```
POST http://localhost:3005/auth/login
Content-Type: application/json

{
  "username": "harish.n@krionconsulting.com",
  "password": "HarishKKM"
}
```

Response:
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": number,
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string"
  }
}
```

### Refresh Token
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "string"
}
```

Response:
```json
{
  "accessToken": "string",
  "expiresIn": number
}
```

### Logout
```
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "string"
}
```

## Usage

### Login Component
The login component has been updated to use username/password authentication:

```typescript
// Login with remember me
this.authService.login({
  username: 'harish.n@krionconsulting.com',
  password: 'HarishKKM',
  rememberMe: true
}).subscribe({
  next: (response) => {
    // Handle successful login - shows success modal
    this.userData = response.user;
    this.showSuccessModal = true;
  },
  error: (error) => {
    // Handle login error
    this.errorMessage = error.error?.message || error.message;
  }
});
```

### Protected Routes
Routes are protected using the AuthGuard:

```typescript
{ 
  path: 'documents', 
  component: DocumentsComponent, 
  canActivate: [AuthGuard] 
}
```

### Logout
```typescript
this.authService.logout();
```

### Check Authentication Status
```typescript
// Check if user is authenticated
if (this.authService.isAuthenticated()) {
  // User is logged in
}

// Get current user
const user = this.authService.getCurrentUser();

// Subscribe to authentication changes
this.authService.isAuthenticated$.subscribe(isAuth => {
  // Handle authentication state changes
});
```

## Token Storage

### Remember Me = false (default)
- Tokens stored in `sessionStorage`
- Tokens cleared when browser tab is closed
- More secure for shared computers

### Remember Me = true
- Tokens stored in `localStorage`
- Tokens persist across browser sessions
- Convenient for personal devices

## Security Features

1. **Token Expiration**: Access tokens expire after 1 hour
2. **Automatic Refresh**: Tokens refreshed automatically before expiration
3. **Secure Storage**: Tokens stored securely in browser storage
4. **JWT Validation**: Tokens validated for structure and expiration
5. **Logout Cleanup**: All tokens cleared on logout
6. **Route Protection**: Unauthorized users redirected to login

## Testing

The system now uses the actual API endpoint for authentication.

### Test Credentials
- **Username**: `harish.n@krionconsulting.com`
- **Password**: `HarishKKM`

### API Endpoint
- **Login**: `http://localhost:3005/auth/login`
- **Method**: POST
- **Content-Type**: application/json

### Authentication Flow

1. **Initial Login**: User enters credentials and clicks "Sign In"
2. **Success Modal**: Shows user info with "Connect" button
3. **Autodesk Authentication**: Clicking "Connect" opens popup for three-legged OAuth
4. **Loading State**: Shows loading indicator during authentication
5. **Popup Monitoring**: System monitors popup window closure
6. **Status Check**: After popup closes, calls status API to check authentication
7. **Sync Modal**: If successful, shows sync modal with accUserId
8. **Data Sync**: Clicking "Sync Data" logs the accUserId and proceeds to app
9. **Manual Check**: User can manually check status if needed

### API Endpoints

#### Initial Login
```
POST http://localhost:3005/auth/login
```

#### Autodesk Authentication
```
GET http://localhost:3005/api/acc-auth/login
```

#### Authentication Status Check
```
GET http://localhost:3005/api/acc-auth/status
```

### Success Modal
After successful login, a beautiful modal appears with:
- Success animation and icon
- User information display
- Connect button to proceed to the application
- Close button as alternative option

## Configuration

### Token Expiration Times
- Access Token: 1 hour (3600 seconds)
- Refresh Token: 24 hours (86400 seconds)
- Auto-refresh threshold: 5 minutes before expiration

### HTTP Interceptor
The AuthInterceptor is configured in `app.config.ts`:

```typescript
provideHttpClient(
  withInterceptors([AuthInterceptor])
)
```

## Error Handling

The system handles various authentication errors:

- **401 Unauthorized**: Automatic token refresh or logout
- **Invalid Credentials**: User-friendly error messages
- **Token Expired**: Automatic refresh or redirect to login
- **Network Errors**: Graceful degradation with user feedback

## Best Practices

1. **Never store sensitive data in tokens**: Only include necessary user information
2. **Use HTTPS in production**: Ensure all API calls use secure connections
3. **Implement proper CORS**: Configure backend to allow frontend domain
4. **Regular token rotation**: Consider implementing token rotation for enhanced security
5. **Monitor token usage**: Log authentication events for security monitoring

## Migration Notes

The existing authentication system has been completely replaced with JWT-based authentication. Key changes:

- Removed simple localStorage-based authentication
- Updated login form to use username/password only
- Added comprehensive token management
- Implemented automatic token refresh
- Enhanced security with proper JWT validation 