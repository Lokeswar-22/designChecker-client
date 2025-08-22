import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  @Output() mobileMenuToggle = new EventEmitter<void>();
  isMobile = false;
  currentUser: any = null;

  constructor(private router: Router, private authService: AuthService) {}

  @HostListener('window:resize')
  onResize() {
    this.checkMobile();
  }

  ngOnInit() {
    this.checkMobile();
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
  }

  checkMobile() {
    this.isMobile = window.innerWidth <= 768;
  }

  toggleMobileMenu() {
    this.mobileMenuToggle.emit();
  }

  onUserClick() {
    if (confirm('Do you want to logout?')) {
      this.authService.logout();
    }
  }

  getUserDisplayName(): string {
    if (this.currentUser) {
      if (this.currentUser.username) {
        return this.currentUser.username;
      }
      if (this.currentUser.firstName || this.currentUser.lastName) {
        return `${this.currentUser.firstName || ''} ${
          this.currentUser.lastName || ''
        }`.trim();
      }
      if (this.currentUser.email) {
        return this.currentUser.email;
      }
    }
    return 'User';
  }
}
