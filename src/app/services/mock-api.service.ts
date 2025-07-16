import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { LoginRequest, LoginResponse, RefreshResponse } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MockApiService {
  private mockUsers = [
    {
      id: '1',
      username: 'admin',
      password: 'admin123',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User'
    },
    {
      id: '2',
      username: 'user',
      password: 'user123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe'
    }
  ];

  private mockTokens = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

  constructor(private http: HttpClient) {}

  // Mock login endpoint
  login(credentials: LoginRequest): Observable<LoginResponse> {
    const user = this.mockUsers.find(u => 
      u.username === credentials.username && u.password === credentials.password
    );

    if (!user) {
      return throwError(() => ({
        status: 401,
        error: { message: 'Invalid username or password' }
      }));
    }

    // Generate mock tokens
    const accessToken = this.generateMockToken(user, 3600); // 1 hour
    const refreshToken = this.generateMockToken(user, 86400); // 24 hours

    // Store tokens for refresh
    this.mockTokens.set(refreshToken, {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 86400 * 1000
    });

    const response: LoginResponse = {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };

    return of(response).pipe(delay(1000)); // Simulate network delay
  }

  // Mock refresh token endpoint
  refreshToken(refreshToken: string): Observable<RefreshResponse> {
    const storedTokens = this.mockTokens.get(refreshToken);

    if (!storedTokens) {
      return throwError(() => ({
        status: 401,
        error: { message: 'Invalid refresh token' }
      }));
    }

    // Generate new access token
    const newAccessToken = this.generateMockToken(
      { id: '1', username: 'admin', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' },
      3600
    );

    // Update stored tokens
    this.mockTokens.set(refreshToken, {
      ...storedTokens,
      accessToken: newAccessToken
    });

    const response: RefreshResponse = {
      accessToken: newAccessToken,
      expiresIn: 3600
    };

    return of(response).pipe(delay(500));
  }

  // Mock logout endpoint
  logout(refreshToken: string): Observable<any> {
    this.mockTokens.delete(refreshToken);
    return of({ success: true }).pipe(delay(300));
  }

  // Generate a simple mock JWT token
  private generateMockToken(user: any, expiresIn: number): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn
    }));
    const signature = btoa('mock-signature');

    return `${header}.${payload}.${signature}`;
  }
} 