import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { LocalService } from '../services/local.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private localService: LocalService
  ) {}

  canActivate(): boolean {
    const token = this.localService.getAccessToken();
    if (!token || this.localService.isTokenExpired()) {
      this.router.navigate(['/login']);
      return false;
    }

    try {
      const payload = this.decodeTokenPayload(token);
      if (!payload) {
        this.router.navigate(['/login']);
        return false;
      }
      return true;
    } catch (e) {
      this.router.navigate(['/login']);
      return false;
    }
  }

  private decodeTokenPayload(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  }
}
