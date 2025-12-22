import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LocalService } from '../../services/local.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-sync-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sync-modal.component.html',
  styleUrl: './sync-modal.component.scss'
})
export class SyncModalComponent {
  @Input() isVisible = false;
  @Input() accUserId: string = '';
  @Output() sync = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  constructor(
    private http: HttpClient,
    private localService: LocalService
  ) {}

  onSync() {
    this.sync.emit(this.accUserId);
    this.syncWithUser(this.accUserId);
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  syncWithUser(accUserId: string) {
    const userData = this.localService.getUserData();
    if (!userData || (!userData.userID && !userData.id)) return;

    const userID = userData.userID || userData.id;
    const accessToken = this.localService.getAccessToken();
    if (!accessToken) return;

    this.http.post(
      `${environment.accAuthEndpoints.sync}?accUserId=${accUserId}&userID=${userID}`,
      {}
    ).subscribe();
  }
}

