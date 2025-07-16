import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './success-modal.html',
  styleUrl: './success-modal.scss'
})
export class SuccessModalComponent {
  @Input() isVisible = false;
  @Input() userData: any = null;
  @Output() connect = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  onConnect() {
    this.connect.emit();
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getUserDisplayName(): string {
    if (this.userData?.firstName && this.userData?.lastName) {
      return `${this.userData.firstName} ${this.userData.lastName}`;
    } else if (this.userData?.firstName) {
      return this.userData.firstName;
    } else if (this.userData?.name) {
      return this.userData.name;
    } else if (this.userData?.username) {
      return this.userData.username;
    }
    return 'User';
  }
} 