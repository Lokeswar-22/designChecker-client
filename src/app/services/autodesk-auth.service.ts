import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AutodeskAuthResponse {
  message: string;
  accUserId?: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  accUserId?: string;
  popupClosed?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AutodeskAuthService implements OnDestroy {
  private authWindow: Window | null = null;
  private authStatusSubject = new BehaviorSubject<AuthStatus>({
    isAuthenticated: false
  });

  public authStatus$ = this.authStatusSubject.asObservable();
  private pollInterval: any;

  constructor(private http: HttpClient) {
    window.addEventListener('message', this.handlePopupMessage.bind(this));
  }

  initiateAutodeskAuth(): void {
    this.authWindow = window.open(
      environment.accAuthEndpoints.login,
      'autodesk_auth',
      'width=800,height=600,scrollbars=yes,resizable=yes'
    );

    if (this.authWindow) {
      this.monitorPopupWindow();
      setTimeout(() => {
        this.injectResponseCaptureScript();
      }, 2000);
    }
  }

  private injectResponseCaptureScript(): void {
    try {
      if (this.authWindow && this.authWindow.document) {
        const script = this.authWindow.document.createElement('script');
        script.textContent = `
          function captureAndSendResponse() {
            try {
              const pageContent = document.body ? document.body.innerText || document.body.textContent : '';
              const currentUrl = window.location.href;

              if (currentUrl.includes('/api/acc-auth/callback')) {
                let jsonResponse = null;
                try {
                  jsonResponse = JSON.parse(pageContent);
                } catch (e) {}

                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                  if (script.textContent && script.textContent.includes('accUserId')) {
                    try {
                      const match = script.textContent.match(/\\{[^}]*"message"[^}]*"accUserId"[^}]*\\}/);
                      if (match) {
                        jsonResponse = JSON.parse(match[0]);
                      }
                    } catch (e) {}
                  }
                });

                window.opener.postMessage({
                  type: 'autodesk_auth_response',
                  url: currentUrl,
                  content: pageContent,
                  jsonData: jsonResponse,
                  timestamp: new Date().toISOString()
                }, '*');
              }
            } catch (error) {}
          }

          captureAndSendResponse();
          let lastUrl = window.location.href;
          const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
              lastUrl = window.location.href;
              setTimeout(captureAndSendResponse, 1000);
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          setInterval(captureAndSendResponse, 2000);
          window.addEventListener('load', captureAndSendResponse);
          document.addEventListener('DOMContentLoaded', captureAndSendResponse);
        `;
        this.authWindow.document.head.appendChild(script);
      }
    } catch (error) {}
  }

  private monitorPopupWindow(): void {
    this.pollInterval = setInterval(() => {
      if (this.authWindow && this.authWindow.closed) {
        clearInterval(this.pollInterval);
        this.authStatusSubject.next({
          isAuthenticated: false,
          popupClosed: true
        });
        this.checkAuthStatusAfterPopupClose();
      } else if (this.authWindow && !this.authWindow.closed) {
        try {
          const currentUrl = this.authWindow.location.href;
          if (currentUrl.includes('/api/acc-auth/callback')) {
            this.capturePopupResponse();
            this.fetchCallbackResponse(currentUrl);
          }
        } catch (error) {}
      }
    }, 1000);
  }

  private handlePopupMessage(event: MessageEvent): void {
    if (event.data && typeof event.data === 'object') {
      if (event.data.type === 'autodesk_auth_response') {
        let userId = null;
        if (event.data.jsonData?.accUserId) {
          userId = event.data.jsonData.accUserId;
        } else if (event.data.jsonData?.userId) {
          userId = event.data.jsonData.userId;
        }

        if (!userId && event.data.content) {
          const content = event.data.content;
          const userIdMatch = content.match(/"accUserId"\s*:\s*"([^"]+)"/) || content.match(/"userId"\s*:\s*"([^"]+)"/);
          if (userIdMatch) userId = userIdMatch[1];
        }

        if (!userId && event.data.url) {
          const urlParams = new URLSearchParams(event.data.url.split('?')[1] || '');
          userId = urlParams.get('accUserId') || urlParams.get('userId');
        }

        if (userId) {
          this.handleAuthSuccess({
            message: 'Authentication successful',
            accUserId: userId
          });
        }
      } else if (event.data.accUserId || event.data.userId) {
        this.handleAuthSuccess(event.data);
      }
    }
  }

  private fetchCallbackResponse(callbackUrl: string): void {
    this.http.get(callbackUrl).subscribe({
      next: (response: any) => {
        if (response?.message && response?.accUserId) {
          this.handleAuthSuccess(response);
        }
      },
      error: () => {}
    });
  }

  private capturePopupResponse(): void {
    try {
      if (this.authWindow && this.authWindow.document) {
        const pageContent = this.authWindow.document.body?.innerText || this.authWindow.document.body?.textContent;
        if (pageContent) {
          try {
            const jsonResponse = JSON.parse(pageContent);
            if (jsonResponse.message && jsonResponse.accUserId) {
              this.handleAuthSuccess(jsonResponse);
            }
          } catch (parseError) {
            const jsonMatch = pageContent.match(/\{[^}]*"message"[^}]*"accUserId"[^}]*\}/);
            if (jsonMatch) {
              try {
                const jsonResponse = JSON.parse(jsonMatch[0]);
                if (jsonResponse.message && jsonResponse.accUserId) {
                  this.handleAuthSuccess(jsonResponse);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {}
  }

  private checkAuthStatusAfterPopupClose(): void {
    setTimeout(() => {
      this.http.get<AutodeskAuthResponse>(environment.accAuthEndpoints.status)
        .pipe(
          tap(response => {
            if (response?.message && response?.accUserId) {
              this.handleAuthSuccess(response);
            } else {
              this.handleAuthFailure();
            }
          }),
          catchError(() => {
            this.handleAuthFailure();
            return of(null);
          })
        )
        .subscribe();
    }, 5000);
  }

  private handleAuthSuccess(response: AutodeskAuthResponse): void {
    this.authStatusSubject.next({
      isAuthenticated: true,
      accUserId: response.accUserId
    });
  }

  private handleAuthFailure(): void {
    this.authStatusSubject.next({
      isAuthenticated: false
    });
  }

  getAuthStatus(): AuthStatus {
    return this.authStatusSubject.value;
  }

  resetAuthStatus(): void {
    this.authStatusSubject.next({
      isAuthenticated: false
    });
  }

  closeAuthWindow(): void {
    if (this.authWindow && !this.authWindow.closed) {
      this.authWindow.close();
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.handlePopupMessage.bind(this));
    this.closeAuthWindow();
  }

  manualCheckAuthStatus(): Observable<AutodeskAuthResponse> {
    return new Observable(observer => {
      setTimeout(() => {
        this.http.get<AutodeskAuthResponse>(environment.accAuthEndpoints.status)
          .subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (error) => observer.error(error)
          });
      }, 5000);
    });
  }
}
