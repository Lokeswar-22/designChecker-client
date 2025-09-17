import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
  providedIn: 'root',
})
export class AutodeskAuthService {
  private authWindow: Window | null = null;
  private authStatusSubject = new BehaviorSubject<AuthStatus>({
    isAuthenticated: false,
  });

  public authStatus$ = this.authStatusSubject.asObservable();
  private pollInterval: any;

  constructor(private http: HttpClient) {
    // Listen for messages from popup window
    window.addEventListener('message', this.handlePopupMessage.bind(this));
  }

  // Start the three-legged authentication process
  initiateAutodeskAuth(): void {
    // Open the Autodesk authentication page in a new window
    this.authWindow = window.open(
      environment.accAuthEndpoints.login,
      'autodesk_auth',
      'width=800,height=600,scrollbars=yes,resizable=yes'
    );

    if (this.authWindow) {
      // Start monitoring the popup window
      this.monitorPopupWindow();

      // Try to inject a script to capture the response
      setTimeout(() => {
        this.injectResponseCaptureScript();
      }, 2000); // Wait 2 seconds for page to load
    }
  }

  // Inject script to capture response from popup
  private injectResponseCaptureScript(): void {
    try {
      if (this.authWindow && this.authWindow.document) {
        const script = this.authWindow.document.createElement('script');
        script.textContent = `
          // Capture page content and send to parent
          function captureAndSendResponse() {
            try {
              // Get page content
              const pageContent = document.body ? document.body.innerText || document.body.textContent : '';
              const currentUrl = window.location.href;

              console.log('Capturing response from URL:', currentUrl);
              console.log('Page content:', pageContent);

              // Check if we're on the callback URL
              if (currentUrl.includes('/api/acc-auth/callback')) {
                console.log('Callback URL detected in popup!');

                // Try to parse the page content as JSON
                let jsonResponse = null;
                try {
                  jsonResponse = JSON.parse(pageContent);
                  console.log('JSON response parsed:', jsonResponse);
                } catch (e) {
                  console.log('Page content is not valid JSON');
                }

                // Look for JSON in script tags
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                  if (script.textContent && script.textContent.includes('accUserId')) {
                    console.log('Script with accUserId found:', script.textContent);
                    try {
                      const match = script.textContent.match(/\\{[^}]*"message"[^}]*"accUserId"[^}]*\\}/);
                      if (match) {
                        jsonResponse = JSON.parse(match[0]);
                        console.log('JSON response from script:', jsonResponse);
                      }
                    } catch (e) {
                      console.log('Failed to parse JSON from script');
                    }
                  }
                });

                // Send data to parent window
                window.opener.postMessage({
                  type: 'autodesk_auth_response',
                  url: currentUrl,
                  content: pageContent,
                  jsonData: jsonResponse,
                  timestamp: new Date().toISOString()
                }, '*');

                console.log('Callback response captured and sent to parent window');
              }
            } catch (error) {
              console.error('Error capturing response:', error);
            }
          }

          // Run immediately
          captureAndSendResponse();

          // Also run when page changes (for SPA navigation)
          let lastUrl = window.location.href;
          const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
              lastUrl = window.location.href;
              console.log('URL changed to:', lastUrl);
              setTimeout(captureAndSendResponse, 1000);
            }
          });

          observer.observe(document.body, { childList: true, subtree: true });

          // Run periodically to catch any missed changes
          setInterval(captureAndSendResponse, 2000);

          // Also listen for load events
          window.addEventListener('load', captureAndSendResponse);
          document.addEventListener('DOMContentLoaded', captureAndSendResponse);
        `;

        this.authWindow.document.head.appendChild(script);
        console.log('Response capture script injected');
      }
    } catch (error) {
      console.log(
        'Cannot inject script due to cross-origin restrictions:',
        error
      );
    }
  }

  // Monitor the popup window for closure and capture response
  private monitorPopupWindow(): void {
    // Check if popup is closed every 1 second
    this.pollInterval = setInterval(() => {
      if (this.authWindow && this.authWindow.closed) {
        console.log(
          'Popup window closed, will check authentication status in 5 seconds...'
        );
        clearInterval(this.pollInterval);

        // Notify that popup is closed and we're waiting
        this.authStatusSubject.next({
          isAuthenticated: false,
          popupClosed: true,
        });

        this.checkAuthStatusAfterPopupClose();
      } else if (this.authWindow && !this.authWindow.closed) {
        // Try to capture the current URL and response from popup
        try {
          const currentUrl = this.authWindow.location.href;
          console.log('Current popup URL:', currentUrl);

          // Check if we're on the specific callback URL
          if (currentUrl.includes('/api/acc-auth/callback')) {
            console.log('Autodesk callback URL detected:', currentUrl);

            // Try to capture the page content/response
            this.capturePopupResponse();

            // Also try to fetch the response directly
            this.fetchCallbackResponse(currentUrl);
          }
        } catch (error) {
          // Cross-origin restrictions might prevent access
          // This is expected behavior for security reasons
          console.log(
            'Cannot access popup due to cross-origin restrictions (this is normal)'
          );
        }
      }
    }, 1000);
  }

  // Handle messages from popup window
  private handlePopupMessage(event: MessageEvent): void {
    // Check if the message contains authentication response
    if (event.data && typeof event.data === 'object') {
      if (event.data.type === 'autodesk_auth_response') {
        console.log('Autodesk authentication response captured:');
        console.log('URL:', event.data.url);
        console.log('Content:', event.data.content);
        console.log('JSON Data:', event.data.jsonData);
        console.log('Timestamp:', event.data.timestamp);

        // Extract user ID from various sources
        let userId = null;

        // Check JSON data first
        if (event.data.jsonData && event.data.jsonData.accUserId) {
          userId = event.data.jsonData.accUserId;
        } else if (event.data.jsonData && event.data.jsonData.userId) {
          userId = event.data.jsonData.userId;
        }

        // Check page content for user ID
        if (!userId && event.data.content) {
          const content = event.data.content;
          const userIdMatch = content.match(/"accUserId"\s*:\s*"([^"]+)"/);
          if (userIdMatch) {
            userId = userIdMatch[1];
          } else {
            const userIdMatch2 = content.match(/"userId"\s*:\s*"([^"]+)"/);
            if (userIdMatch2) {
              userId = userIdMatch2[1];
            }
          }
        }

        // Check URL for user ID
        if (!userId && event.data.url) {
          const urlParams = new URLSearchParams(
            event.data.url.split('?')[1] || ''
          );
          userId = urlParams.get('accUserId') || urlParams.get('userId');
        }

        if (userId) {
          console.log('User ID extracted:', userId);
          this.handleAuthSuccess({
            message: 'Authentication successful',
            accUserId: userId,
          });
        } else {
          console.log('No user ID found in response');
        }
      } else if (event.data.accUserId || event.data.userId) {
        console.log('User ID found in message:', event.data);
        this.handleAuthSuccess(event.data);
      }
    }
  }

  // Fetch callback response directly
  private fetchCallbackResponse(callbackUrl: string): void {
    console.log('Fetching callback response from:', callbackUrl);

    // Make a direct HTTP request to the callback URL
    this.http.get(callbackUrl).subscribe({
      next: (response: any) => {
        console.log('=== CALLBACK RESPONSE RECEIVED ===');
        console.log('Full response:', response);

        if (response && response.message && response.accUserId) {
          console.log('✅ Authentication successful!');
          console.log('📝 Message:', response.message);
          console.log('🆔 accUserId:', response.accUserId);
          console.log('================================');

          // Handle the successful authentication
          this.handleAuthSuccess(response);
        } else {
          console.log('❌ Response does not contain expected fields');
          console.log('Response keys:', Object.keys(response || {}));
        }
      },
      error: (error) => {
        console.error('❌ Error fetching callback response:', error);
        console.error('Error details:', error.error || error.message);
      },
    });
  }

  // Capture response from popup window
  private capturePopupResponse(): void {
    try {
      // Try to access the popup window's document
      if (this.authWindow && this.authWindow.document) {
        const pageContent =
          this.authWindow.document.body?.innerText ||
          this.authWindow.document.body?.textContent;
        console.log('Popup page content:', pageContent);

        // Try to find JSON response in the page
        const scripts = this.authWindow.document.querySelectorAll('script');
        scripts.forEach((script) => {
          if (script.textContent) {
            console.log('Script content:', script.textContent);
          }
        });

        // Try to find any JSON data
        const jsonElements = this.authWindow.document.querySelectorAll(
          '[data-json], [data-response]'
        );
        jsonElements.forEach((element) => {
          console.log('JSON element:', element.textContent);
        });

        // Look for JSON response in the page content
        if (pageContent) {
          try {
            // Try to parse the entire page content as JSON
            const jsonResponse = JSON.parse(pageContent);
            console.log('JSON response found in page content:', jsonResponse);

            if (jsonResponse.message && jsonResponse.accUserId) {
              console.log('Authentication successful!');
              console.log('Message:', jsonResponse.message);
              console.log('accUserId:', jsonResponse.accUserId);

              this.handleAuthSuccess(jsonResponse);
            }
          } catch (parseError) {
            // If not valid JSON, look for JSON patterns in the content
            const jsonMatch = pageContent.match(
              /\{[^}]*"message"[^}]*"accUserId"[^}]*\}/
            );
            if (jsonMatch) {
              try {
                const jsonResponse = JSON.parse(jsonMatch[0]);
                console.log(
                  'JSON response found in page content (regex):',
                  jsonResponse
                );

                if (jsonResponse.message && jsonResponse.accUserId) {
                  console.log('Authentication successful!');
                  console.log('Message:', jsonResponse.message);
                  console.log('accUserId:', jsonResponse.accUserId);

                  this.handleAuthSuccess(jsonResponse);
                }
              } catch (e) {
                console.log('Failed to parse JSON from regex match');
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(
        'Cannot access popup content due to cross-origin restrictions:',
        error
      );
    }
  }

  // Check authentication status after popup is closed
  private checkAuthStatusAfterPopupClose(): void {
    console.log('Popup closed, waiting 5 seconds before checking status...');

    // Wait 5 seconds before checking the status
    setTimeout(() => {
      console.log('Checking authentication status after 5 second delay...');

      this.http
        .get<AutodeskAuthResponse>(environment.accAuthEndpoints.status)
        .pipe(
          tap((response) => {
            console.log('=== STATUS API RESPONSE ===');
            console.log('Full response:', response);

            if (response && response.message && response.accUserId) {
              console.log('✅ Authentication successful!');
              console.log('📝 Message:', response.message);
              console.log('🆔 accUserId:', response.accUserId);
              console.log('==========================');
              this.handleAuthSuccess(response);
            } else {
              console.log('❌ Authentication not completed or failed');
              console.log('Response:', response);
              this.handleAuthFailure();
            }
          }),
          catchError((error) => {
            console.error('❌ Error checking auth status:', error);
            console.error('Error details:', error.error || error.message);
            this.handleAuthFailure();
            return of(null);
          })
        )
        .subscribe();
    }, 5000); // 5 second delay
  }

  // Handle successful authentication
  private handleAuthSuccess(response: AutodeskAuthResponse): void {
    console.log('Autodesk authentication successful:', response);

    // Update authentication status
    this.authStatusSubject.next({
      isAuthenticated: true,
      accUserId: response.accUserId,
    });
  }

  // Handle authentication failure
  private handleAuthFailure(): void {
    console.log('Autodesk authentication failed or incomplete');
    this.authStatusSubject.next({
      isAuthenticated: false,
    });
  }

  // Get current authentication status
  getAuthStatus(): AuthStatus {
    return this.authStatusSubject.value;
  }

  // Reset authentication status
  resetAuthStatus(): void {
    this.authStatusSubject.next({
      isAuthenticated: false,
    });
  }

  // Close auth window if open
  closeAuthWindow(): void {
    if (this.authWindow && !this.authWindow.closed) {
      this.authWindow.close();
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  // Cleanup method to remove event listeners
  ngOnDestroy(): void {
    window.removeEventListener('message', this.handlePopupMessage.bind(this));
    this.closeAuthWindow();
  }

  // Manual check auth status (can be called from UI if needed)
  manualCheckAuthStatus(): Observable<AutodeskAuthResponse> {
    console.log('Manual status check requested, waiting 5 seconds...');

    // Return an observable that waits 5 seconds before making the request
    return new Observable((observer) => {
      setTimeout(() => {
        console.log('Making manual status check after 5 second delay...');

        this.http
          .get<AutodeskAuthResponse>(environment.accAuthEndpoints.status)
          .subscribe({
            next: (response) => {
              console.log('=== MANUAL STATUS CHECK RESPONSE ===');
              console.log('Full response:', response);
              observer.next(response);
              observer.complete();
            },
            error: (error) => {
              console.error('❌ Manual status check error:', error);
              observer.error(error);
            },
          });
      }, 5000);
    });
  }
}
