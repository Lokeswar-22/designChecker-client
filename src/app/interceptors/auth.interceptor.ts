import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

// Global state for refresh token handling
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const AuthInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<any> => {
  const authService = inject(AuthService);

  console.log('AuthInterceptor: Intercepting request to:', request.url);
  console.log('AuthInterceptor: Request method:', request.method);

  // Skip token for auth endpoints
  if (isAuthEndpoint(request.url)) {
    console.log('AuthInterceptor: Skipping auth endpoint:', request.url);
    return next(request);
  }

  // Add token to request
  const token = authService.getAccessToken();
  console.log('AuthInterceptor: Token available:', !!token);
  console.log('AuthInterceptor: Token value:', token);
  
  if (token) {
    request = addToken(request, token);
    console.log('AuthInterceptor: Added token to request headers:', request.headers.get('Authorization'));
  } else {
    console.log('AuthInterceptor: No token available, proceeding without Authorization header');
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      console.log('AuthInterceptor: Request failed with status:', error.status);
      if (error.status === 401 && !isRefreshing) {
        console.log('AuthInterceptor: Handling 401 error');
        return handle401Error(request, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/api/auth/') || 
         url.includes(environment.authEndpoints.login) || 
         url.includes(environment.accAuthEndpoints.login) ||
         url.includes(environment.accAuthEndpoints.status) ||
         url.includes(environment.accAuthEndpoints.sync) ||
         url.includes(environment.accAuthEndpoints.viewerToken);
}

function handle401Error(
  request: HttpRequest<any>, 
  next: HttpHandlerFn, 
  authService: AuthService
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);
        return next(addToken(request, response.accessToken));
      }),
      catchError((error) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => error);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next(addToken(request, token!)))
    );
  }
} 