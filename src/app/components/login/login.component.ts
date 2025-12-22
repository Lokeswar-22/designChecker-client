import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, LoginRequest, RegisterRequest } from '../../services/auth.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { LocalService } from '../../services/local.service';
import { SuccessModalComponent } from '../success-modal/success-modal.component';
import { SyncModalComponent } from '../sync-modal/sync-modal.component';
import { AutodeskLoadingComponent } from '../autodesk-loading/autodesk-loading.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, SuccessModalComponent, SyncModalComponent, AutodeskLoadingComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  loginData: LoginRequest = {
    username: '',
    password: ''
  };

  registerData: RegisterRequest = {
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  };

  confirmPassword = '';
  isLoginMode = true;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  showRegisterPassword = false;
  rememberMe = false;
  errorMessage = '';
  successMessage = '';
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
    private localService: LocalService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.authSubscription = this.autodeskAuthService.authStatus$.subscribe(status => {
      if (status.isAuthenticated) {
        this.showSuccessModal = false;
        this.showAutodeskLoading = false;
        this.showSyncModal = true;
        this.accUserId = status.accUserId || '';
      } else if (status.popupClosed && this.showAutodeskLoading) {
        this.errorMessage = '';
      } else if (this.showAutodeskLoading && !status.popupClosed) {
        this.showAutodeskLoading = false;
        this.errorMessage = 'Autodesk authentication failed. Please try again.';
      }
    });
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
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
        this.isLoading = false;

        if (response.success === false) {
          this.errorMessage = response.data?.message || response.message || 'Login failed. Please try again.';
          return;
        }

        if (response.data && response.data.user) {
          this.userData = response.data.user;
        } else if (response.user) {
          this.userData = response.user;
        } else {
          this.userData = {
            username: loginRequest.username,
            email: loginRequest.username
          };
        }

        this.showSuccessModal = true;
      },
      error: (error) => {
        this.isLoading = false;
        if (error.error?.data?.message) {
          this.errorMessage = error.error.data.message;
        } else if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = error.message || 'Login failed. Please try again.';
        }
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleRememberMe() {
    this.rememberMe = !this.rememberMe;
  }

  toggleLoginMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetForms();
  }

  resetForms() {
    this.loginData = { username: '', password: '' };
    this.registerData = { firstName: '', lastName: '', email: '', password: '' };
    this.confirmPassword = '';
    this.showPassword = false;
    this.showConfirmPassword = false;
    this.showRegisterPassword = false;
    this.rememberMe = false;
  }

  onRegister() {
    if (!this.registerData.firstName || !this.registerData.lastName ||
        !this.registerData.email || !this.registerData.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    if (this.registerData.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    if (this.registerData.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.registerData).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Registration successful! Please login with your new account.';
        this.toastService.showSuccess('Registration successful! Please login with your new account.');
        setTimeout(() => {
          this.resetForms();
          this.isLoginMode = true;
          this.successMessage = '';
        }, 2000);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.error?.data?.message) {
          this.errorMessage = error.error.data.message;
        } else if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = error.message || 'Registration failed. Please try again.';
        }
      }
    });
  }

  onConnect() {
    this.showSuccessModal = false;
    this.showAutodeskLoading = true;
    this.autodeskAuthService.initiateAutodeskAuth();
  }

  onCloseModal() {
    this.showSuccessModal = false;
    this.router.navigate(['/documents']);
  }

  onSync(accUserId: string) {
    this.showSyncModal = false;
    const currentUserData = this.localService.getUserData() || {};
    const updatedUserData = { ...currentUserData, accUserId: accUserId };
    this.localService.setUserData(updatedUserData);
    this.authService.refreshAuthState();
    this.router.navigate(['/documents']);
  }

  onCloseSyncModal() {
    this.showSyncModal = false;
    if (this.accUserId) {
      const currentUserData = this.localService.getUserData() || {};
      const updatedUserData = { ...currentUserData, accUserId: this.accUserId };
      this.localService.setUserData(updatedUserData);
    }
    this.router.navigate(['/documents']);
  }

  onManualCheck() {
    this.errorMessage = '';
    this.autodeskAuthService.manualCheckAuthStatus().subscribe({
      next: (response) => {
        if (response.message?.includes('Authentication successful')) {
          this.showAutodeskLoading = false;
          this.showSyncModal = true;
          this.accUserId = response.accUserId || '';
        } else {
          this.errorMessage = 'Authentication not completed. Please complete the process in the popup window.';
        }
      },
      error: () => {
        this.errorMessage = 'Unable to check authentication status. Please try again.';
      }
    });
  }

  downloadUserGuide() {
    const link = document.createElement('a');
    link.href = 'assets/pdf/design-qc-user-guide.pdf';
    link.download = 'Design-QC-User-Guide.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toastService.showSuccess('User Guide download started!');
  }
}

