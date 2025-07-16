import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sync-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sync-modal.html',
  styleUrl: './sync-modal.scss'
})
export class SyncModalComponent {
  @Input() isVisible = false;
  @Input() accUserId: string = '';
  @Output() sync = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  onSync() {
    this.sync.emit(this.accUserId);
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
} 