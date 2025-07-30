import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LocalService } from '../../services/local.service';
import { environment } from '../../../environments/environment';

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

  constructor(
    private http: HttpClient,
    private localService: LocalService
  ) {}

  onSync() {
    this.sync.emit(this.accUserId);
    this.syncWithUSer(this.accUserId);
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  syncWithUSer(accUserId: string) {
    console.log("SYNCING WITH USER", accUserId);
    
    // Get user data from local service
    const userData = this.localService.getUserData();
    if (!userData || (!userData.userID && !userData.id)) {
      console.error("No user data available for sync");
      return;
    }
    
    // Get userID from stored user data
    const userID = userData.userID || userData.id;
    
    // Get accessToken from local service
    const accessToken = this.localService.getAccessToken();
    if (!accessToken) {
      console.error("No access token available for sync");
      return;
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`
    });

    this.http.post(
      `${environment.accAuthEndpoints.sync}?accUserId=${accUserId}&userID=${userID}`,
      {}
    ).subscribe((response) => {
      console.log("SYNC RESPONSE", response);
    });

  }

} 