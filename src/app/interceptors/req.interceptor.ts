import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { LocalService } from '../services/local.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const ReqInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<any> => {
  const localService = inject(LocalService);
  const authService = inject(AuthService);

  if (isAuthEndpoint(request.url)) {
    return next(request);
  }

  const token = localService.getAccessToken();
  if (token) {
    request = addToken(request, token);
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isRefreshing) {
        return handle401Error(request, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
  return request.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
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
