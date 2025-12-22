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
  token?: string;
  user?: {
    id?: string;
    userID?: number;
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    isAccSynced?: boolean;
    createdAt?: string;
    modifiedAt?: string;
    deletedAt?: string | null;
  };
  success?: boolean;
  message?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    message?: string;
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
          if (response.success !== false) {
            this.handleSuccessfulLogin(response, credentials.rememberMe || false);
          }
        }),
        catchError(error => throwError(() => error))
      );
  }

  register(credentials: RegisterRequest): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(environment.authEndpoints.register, credentials, { headers })
      .pipe(catchError(error => throwError(() => error)));
  }

  private handleSuccessfulLogin(response: LoginResponse, rememberMe: boolean): void {
    let accessToken = '';
    let refreshToken = '';
    let userData = {};

    if (response.data) {
      accessToken = response.data.accessToken || '';
      refreshToken = response.data.refreshToken || '';
      userData = response.data.user || {};
    } else {
      accessToken = response.accessToken || response.token || '';
      refreshToken = response.refreshToken || '';
      userData = response.user || {};
    }

    const expiresIn = response.expiresIn || 3600;

    this.localService.setTokens(accessToken, refreshToken, expiresIn, rememberMe);

    if (userData && (userData as any).name && !(userData as any).firstName) {
      const nameParts = (userData as any).name.split(' ');
      (userData as any).firstName = nameParts[0] || '';
      (userData as any).lastName = nameParts.slice(1).join(' ') || '';
    }

    this.localService.setUserData(userData);
    this.currentUserSubject.next(userData);
    this.isAuthenticatedSubject.next(true);
  }

  logout(): void {
    const refreshToken = this.localService.getRefreshToken();
    if (refreshToken) {
      of({ success: true }).pipe(delay(300)).subscribe();
    }
    this.localService.clearAll();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<RefreshResponse> {
    if (this.isRefreshing) {
      return this.refreshTokenSubject.asObservable().pipe(
        map(token => {
          if (token) return { accessToken: token, expiresIn: 3600 };
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
        this.logout();
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

  refreshAuthState(): void {
    if (this.localService.isAuthenticated()) {
      const userData = this.localService.getUserData();
      if (userData) {
        this.currentUserSubject.next(userData);
        this.isAuthenticatedSubject.next(true);
      } else {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
    } else {
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    }
  }

  validateToken(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.exp > (Date.now() / 1000);
    } catch (error) {
      return false;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch (error) {
      return null;
    }
  }

  getTokenExpirationTime(token: string): number | null {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.exp * 1000;
    } catch (error) {
      return null;
    }
  }

  isTokenExpiringSoon(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    const expirationTime = this.getTokenExpirationTime(token);
    if (!expirationTime) return true;
    return (expirationTime - Date.now()) < (5 * 60 * 1000);
  }

  autoRefreshTokenIfNeeded(): Observable<string | null> {
    if (this.isTokenExpiringSoon() && !this.isRefreshing) {
      return this.refreshToken().pipe(map(response => response.accessToken));
    }
    return of(this.getAccessToken());
  }

  checkAccStatus(): Observable<any> {
    const userData = this.getCurrentUser();
    if (!userData || (!userData.id && !userData.userID)) return throwError(() => new Error('No user data available'));
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { userID: userData.userID || userData.id };
    return this.http.post(environment.authEndpoints.checkAccStatus, body, { headers })
      .pipe(catchError(error => throwError(() => error)));
  }
}
