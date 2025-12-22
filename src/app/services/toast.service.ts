import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  showSuccess(message: string, duration: number = 5000): void {
    this.addToast({
      id: this.generateId(),
      message,
      type: 'success',
      duration
    });
  }

  showError(message: string, duration: number = 5000): void {
    this.addToast({
      id: this.generateId(),
      message,
      type: 'error',
      duration
    });
  }

  showInfo(message: string, duration: number = 5000): void {
    this.addToast({
      id: this.generateId(),
      message,
      type: 'info',
      duration
    });
  }

  showWarning(message: string, duration: number = 5000): void {
    this.addToast({
      id: this.generateId(),
      message,
      type: 'warning',
      duration
    });
  }

  removeToast(id: string): void {
    const currentToasts = this.toastsSubject.value;
    const updatedToasts = currentToasts.filter(toast => toast.id !== id);
    this.toastsSubject.next(updatedToasts);
  }

  private addToast(toast: ToastMessage): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    if (toast.duration) {
      setTimeout(() => {
        this.removeToast(toast.id);
      }, toast.duration);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}
