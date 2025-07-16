import { Injectable } from '@angular/core';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  rememberMe: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocalService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly TOKEN_EXPIRY_KEY = 'token_expiry';
  private readonly REMEMBER_ME_KEY = 'remember_me';
  private readonly USER_DATA_KEY = 'user_data';

  constructor() {}

  // Token management
  setTokens(accessToken: string, refreshToken: string, expiresIn: number, rememberMe: boolean = false): void {
    console.log('LocalService: setTokens called');
    console.log('LocalService: Access token:', accessToken);
    console.log('LocalService: Refresh token:', refreshToken);
    console.log('LocalService: Expires in:', expiresIn);
    console.log('LocalService: Remember me:', rememberMe);
    
    const expiresAt = Date.now() + (expiresIn * 1000);
    console.log('LocalService: Token expires at:', new Date(expiresAt));
    
    if (rememberMe) {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiresAt.toString());
      localStorage.setItem(this.REMEMBER_ME_KEY, 'true');
      console.log('LocalService: Tokens stored in localStorage');
    } else {
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      sessionStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      sessionStorage.setItem(this.TOKEN_EXPIRY_KEY, expiresAt.toString());
      sessionStorage.setItem(this.REMEMBER_ME_KEY, 'false');
      console.log('LocalService: Tokens stored in sessionStorage');
    }
    
    console.log('LocalService: Token storage complete');
  }

  getAccessToken(): string | null {
    const localToken = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    const sessionToken = sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
    const token = localToken || sessionToken;
    
    console.log('LocalService: getAccessToken called');
    console.log('LocalService: localStorage token:', localToken);
    console.log('LocalService: sessionStorage token:', sessionToken);
    console.log('LocalService: Returning token:', token);
    
    return token;
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY) || sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getTokenExpiry(): number | null {
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY) || sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  }

  isRememberMe(): boolean {
    const rememberMe = localStorage.getItem(this.REMEMBER_ME_KEY) || sessionStorage.getItem(this.REMEMBER_ME_KEY);
    return rememberMe === 'true';
  }

  isTokenExpired(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() >= expiry;
  }

  updateAccessToken(accessToken: string, expiresIn: number): void {
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    if (this.isRememberMe()) {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiresAt.toString());
    } else {
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      sessionStorage.setItem(this.TOKEN_EXPIRY_KEY, expiresAt.toString());
    }
  }

  // User data management
  setUserData(userData: any): void {
    const data = JSON.stringify(userData);
    if (this.isRememberMe()) {
      localStorage.setItem(this.USER_DATA_KEY, data);
    } else {
      sessionStorage.setItem(this.USER_DATA_KEY, data);
    }
  }

  getUserData(): any {
    const data = localStorage.getItem(this.USER_DATA_KEY) || sessionStorage.getItem(this.USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  }

  // Cleanup
  clearAll(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    localStorage.removeItem(this.REMEMBER_ME_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
    
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(this.REMEMBER_ME_KEY);
    sessionStorage.removeItem(this.USER_DATA_KEY);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired();
  }
} 