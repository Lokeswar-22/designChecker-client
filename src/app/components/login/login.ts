import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, LoginRequest } from '../../services/auth.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { LocalService } from '../../services/local.service';
import { SuccessModalComponent } from '../success-modal/success-modal';
import { SyncModalComponent } from '../sync-modal/sync-modal';
import { AutodeskLoadingComponent } from '../autodesk-loading/autodesk-loading';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, SuccessModalComponent, SyncModalComponent, AutodeskLoadingComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  loginData: LoginRequest = {
    username: '',
    password: ''
  };

  isLoading = false;
  showPassword = false;
  rememberMe = false;
  errorMessage = '';
  showSuccessModal = false;
  showSyncModal = false;
  showAutodeskLoading = false;
  userData: any = null;
  accUserId: string = '';
  private authSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private autodeskAuthService: AutodeskAuthService,
    private localService: LocalService
  ) {}

  ngOnInit() {
    // Subscribe to Autodesk authentication status
    this.authSubscription = this.autodeskAuthService.authStatus$.subscribe(status => {
      if (status.isAuthenticated) {
        this.showSuccessModal = false;
        this.showAutodeskLoading = false;
        this.showSyncModal = true;
        this.accUserId = status.accUserId || '';
      } else if (status.popupClosed && this.showAutodeskLoading) {
        // Popup is closed, show waiting message
        this.errorMessage = '';
        // Keep loading visible while waiting for status check
      } else if (this.showAutodeskLoading && !status.popupClosed) {
        // If authentication failed, hide loading and show error
        this.showAutodeskLoading = false;
        this.errorMessage = 'Autodesk authentication failed. Please try again.';
      }
    });
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    // Close any open auth windows
    this.autodeskAuthService.closeAuthWindow();
  }

  onSubmit() {
    if (!this.loginData.username || !this.loginData.password) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginRequest: LoginRequest = {
      username: this.loginData.username,
      password: this.loginData.password,
      rememberMe: this.rememberMe
    };

    this.authService.login(loginRequest).subscribe({
      next: (response) => {
        console.log('Login response:', response);
        this.isLoading = false;
        
        // Check if the response indicates failure
        if (response.success === false) {
          // Handle failed login response
          const errorMsg = response.data?.message || response.message || 'Login failed. Please try again.';
          this.errorMessage = errorMsg;
          console.error('Login failed:', errorMsg);
          return; // Don't proceed to next steps
        }
        
        // Handle successful login
        console.log('Login successful:', response);
        
        // Handle different user data formats based on response structure
        if (response.data && response.data.user) {
          // New response structure with data wrapper
          this.userData = response.data.user;
        } else if (response.user) {
          // Old response structure
          this.userData = response.user;
        } else {
          // Fallback
          this.userData = {
            username: loginRequest.username,
            email: loginRequest.username
          };
        }
        
        // Check ACC status after successful login
        this.checkAccStatus();
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.isLoading = false;
        
        // Handle different error response formats
        if (error.error && error.error.data && error.error.data.message) {
          // Handle the specific API response format
          this.errorMessage = error.error.data.message;
        } else if (error.error && error.error.message) {
          // Handle error with message in error object
          this.errorMessage = error.error.message;
        } else if (error.message) {
          // Handle error with message property
          this.errorMessage = error.message;
        } else {
          // Fallback error message
          this.errorMessage = 'Login failed. Please try again.';
        }
      }
    });
  }

  private checkAccStatus() {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.checkAccStatus().subscribe({
      next: (response) => {
        console.log('ACC status check response:', response);
        this.isLoading = false;

        // Only show connect modal if user is not synced with ACC
        if (
          response.success === false &&
          response.message === 'User is not synced with ACC' &&
          response.data &&
          response.data.isAccSynced === false &&
          response.data.isTokenValid === false
        ) {
          // Show connect (Autodesk login) modal
          this.showSuccessModal = true;
          return;
        }

        // User is already synced and token is valid
        if (response.success && response.data) {
          const { isAccSynced, isTokenValid, accUserId } = response.data;

          if (isAccSynced && isTokenValid) {
            // Store the accUserId in user data if available
            if (accUserId) {
              const currentUserData = this.localService.getUserData() || {};
              const updatedUserData = { ...currentUserData, accUserId: accUserId };
              this.localService.setUserData(updatedUserData);
              console.log('LoginComponent: Stored accUserId from ACC status check:', updatedUserData);
            }
            // Navigate to documents
            this.router.navigate(['/documents']);
            return;
          }
        }

        // For all other cases, show a generic error
        this.errorMessage = response.message || 'Unable to check ACC status.';
      },
      error: (error) => {
        console.error('ACC status check failed:', error);
        this.isLoading = false;
        // Show error message, do not show connect modal
        this.errorMessage = 'Unable to check ACC status. Please try again.';
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleRememberMe() {
    this.rememberMe = !this.rememberMe;
  }

  onConnect() {
    this.showSuccessModal = false;
    this.showAutodeskLoading = true;
    // Start the Autodesk three-legged authentication
    this.autodeskAuthService.initiateAutodeskAuth();
  }

  onCloseModal() {
    this.showSuccessModal = false;
    this.router.navigate(['/documents']);
  }

  onSync(accUserId: string) {
    console.log('accUserId:', accUserId);
    this.showSyncModal = false;
    
    // Store the accUserId in user data
    const currentUserData = this.localService.getUserData() || {};
    const updatedUserData = { ...currentUserData, accUserId: accUserId };
    this.localService.setUserData(updatedUserData);
    console.log('LoginComponent: Stored accUserId in user data:', updatedUserData);
    
    // Ensure authentication state is properly set
    this.authService.refreshAuthState();
    console.log('LoginComponent: After sync - Auth service isAuthenticated:', this.authService.isAuthenticated());
    console.log('LoginComponent: After sync - Access token:', this.authService.getAccessToken());
    
    this.router.navigate(['/documents']);
  }

  onCloseSyncModal() {
    this.showSyncModal = false;
    
    // Store the accUserId in user data if available
    if (this.accUserId) {
      const currentUserData = this.localService.getUserData() || {};
      const updatedUserData = { ...currentUserData, accUserId: this.accUserId };
      this.localService.setUserData(updatedUserData);
      console.log('LoginComponent: Stored accUserId in user data (close modal):', updatedUserData);
    }
    
    this.router.navigate(['/documents']);
  }

  onManualCheck() {
    // Update loading message to show waiting
    this.errorMessage = '';
    
    // Manually check authentication status
    this.autodeskAuthService.manualCheckAuthStatus().subscribe({
      next: (response) => {
        console.log('Manual check response:', response);
        if (response.message && response.message.includes('Authentication successful')) {
          this.showAutodeskLoading = false;
          this.showSyncModal = true;
          this.accUserId = response.accUserId || '';
        } else {
          this.errorMessage = 'Authentication not completed. Please complete the process in the popup window.';
        }
      },
      error: (error) => {
        console.error('Manual check error:', error);
        this.errorMessage = 'Unable to check authentication status. Please try again.';
      }
    });
  }
} 