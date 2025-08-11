import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, map, tap, delay } from 'rxjs/operators';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { LocalService } from './local.service';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  token?: string; // Alternative field name
  user?: {
    id?: string;
    userID?: number; // Added to match actual API response
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string; // Alternative field name
    isAccSynced?: boolean; // Added to match actual API response
    createdAt?: string;
    modifiedAt?: string;
    deletedAt?: string | null;
  };
  // Handle different response formats
  success?: boolean;
  message?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    message?: string; // Added for error messages in data object
    user?: {
      userID?: number;
      firstName?: string;
      lastName?: string;
      email?: string;
      isAccSynced?: boolean;
      createdAt?: string;
      modifiedAt?: string;
      deletedAt?: string | null;
    };
  };
  statusCode?: number;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router,
    private localService: LocalService
  ) {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    if (this.localService.isAuthenticated()) {
      const userData = this.localService.getUserData();
      if (userData) {
        this.currentUserSubject.next(userData);
        this.isAuthenticatedSubject.next(true);
      }
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    
    return this.http.post<LoginResponse>(environment.authEndpoints.login, credentials, { headers })
      .pipe(
        tap(response => {
          // Only handle successful login if success is true or undefined (for backward compatibility)
          if (response.success !== false) {
            this.handleSuccessfulLogin(response, credentials.rememberMe || false);
          }
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  register(credentials: RegisterRequest): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    
    return this.http.post(environment.authEndpoints.register, credentials, { headers })
      .pipe(
        catchError(error => {
          console.error('Registration error:', error);
          return throwError(() => error);
        })
      );
  }

  private handleSuccessfulLogin(response: LoginResponse, rememberMe: boolean): void {
    console.log('AuthService: handleSuccessfulLogin called with response:', response);
    
    // Additional safety check - don't process if success is explicitly false
    if (response.success === false) {
      console.log('AuthService: Login response indicates failure, not processing');
      return;
    }
    
    // Handle different response structures
    let accessToken = '';
    let refreshToken = '';
    let userData = {};
    
    if (response.data) {
      // New response structure with data wrapper
      accessToken = response.data.accessToken || '';
      refreshToken = response.data.refreshToken || '';
      userData = response.data.user || {};
    } else {
      // Old response structure
      accessToken = response.accessToken || response.token || '';
      refreshToken = response.refreshToken || '';
      userData = response.user || {};
    }
    
    const expiresIn = response.expiresIn || 3600; // Default to 1 hour

    console.log('AuthService: Access token from response:', accessToken);
    console.log('AuthService: Refresh token from response:', refreshToken);
    console.log('AuthService: Expires in:', expiresIn);

    // Store tokens
    this.localService.setTokens(
      accessToken,
      refreshToken,
      expiresIn,
      rememberMe
    );

    console.log('AuthService: Tokens stored in local service');
    console.log('AuthService: Access token in local service:', this.localService.getAccessToken());
    console.log('AuthService: Local service isAuthenticated:', this.localService.isAuthenticated());

    // Handle different user data formats
    if (userData && (userData as any).name && !(userData as any).firstName) {
      // Split name into firstName and lastName
      const nameParts = (userData as any).name.split(' ');
      (userData as any).firstName = nameParts[0] || '';
      (userData as any).lastName = nameParts.slice(1).join(' ') || '';
    }

    // Store user data
    this.localService.setUserData(userData);

    // Update subjects
    this.currentUserSubject.next(userData);
    this.isAuthenticatedSubject.next(true);
    
    console.log('AuthService: Authentication subjects updated');
    console.log('AuthService: isAuthenticated subject value:', this.isAuthenticatedSubject.value);
  }

  logout(): void {
    // Mock logout - in production, call actual logout endpoint
    const refreshToken = this.localService.getRefreshToken();
    if (refreshToken) {
      // Simulate logout API call
      of({ success: true }).pipe(delay(300)).subscribe({
        next: () => console.log('Logout successful'),
        error: (error) => console.error('Logout error:', error)
      });
    }

    // Clear local storage
    this.localService.clearAll();

    // Update subjects
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);

    // Navigate to login
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<RefreshResponse> {
    if (this.isRefreshing) {
      return this.refreshTokenSubject.asObservable().pipe(
        map(token => {
          if (token) {
            return { accessToken: token, expiresIn: 3600 };
          }
          throw new Error('No refresh token available');
        })
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    const refreshToken = this.localService.getRefreshToken();
    if (!refreshToken) {
      this.isRefreshing = false;
      return throwError(() => new Error('No refresh token available'));
    }

    // Mock refresh token response
    const mockResponse: RefreshResponse = {
      accessToken: 'mock-refreshed-access-token-' + Date.now(),
      expiresIn: 3600
    };

    return of(mockResponse).pipe(
      delay(500),
      tap(response => {
        this.isRefreshing = false;
        this.localService.updateAccessToken(response.accessToken, response.expiresIn);
        this.refreshTokenSubject.next(response.accessToken);
      }),
      catchError(error => {
        this.isRefreshing = false;
        this.refreshTokenSubject.next(null);
        this.logout(); // Force logout on refresh failure
        return throwError(() => error);
      })
    );
  }

  getAccessToken(): string | null {
    return this.localService.getAccessToken();
  }

  isTokenExpired(): boolean {
    return this.localService.isTokenExpired();
  }

  isAuthenticated(): boolean {
    return this.localService.isAuthenticated();
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  // Public method to refresh authentication state
  refreshAuthState(): void {
    console.log('Refreshing authentication state...');
    if (this.localService.isAuthenticated()) {
      const userData = this.localService.getUserData();
      if (userData) {
        console.log('User data found, updating subjects');
        this.currentUserSubject.next(userData);
        this.isAuthenticatedSubject.next(true);
      } else {
        console.log('No user data found, clearing subjects');
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
    } else {
      console.log('Not authenticated, clearing subjects');
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    }
  }

  // JWT validation and decoding
  validateToken(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch (error) {
      console.error('Token decode error:', error);
      return null;
    }
  }

  getTokenExpirationTime(token: string): number | null {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.error('Error getting token expiration:', error);
      return null;
    }
  }

  // Check if token will expire soon (within 5 minutes)
  isTokenExpiringSoon(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    const expirationTime = this.getTokenExpirationTime(token);
    if (!expirationTime) return true;

    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (expirationTime - Date.now()) < fiveMinutes;
  }

  // Auto-refresh token if it's expiring soon
  autoRefreshTokenIfNeeded(): Observable<string | null> {
    if (this.isTokenExpiringSoon() && !this.isRefreshing) {
      return this.refreshToken().pipe(
        map(response => response.accessToken)
      );
    }
    return new Observable(observer => {
      observer.next(this.getAccessToken());
      observer.complete();
    });
  }

  // Check ACC authentication status
  checkAccStatus(): Observable<any> {
    const userData = this.getCurrentUser();
    if (!userData || (!userData.id && !userData.userID)) {
      return throwError(() => new Error('No user data available'));
    }

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { userID: userData.userID || userData.id };

    return this.http.post(environment.authEndpoints.checkAccStatus, body, { headers })
      .pipe(
        catchError(error => {
          console.error('ACC status check failed:', error);
          return throwError(() => error);
        })
      );
  }
} 