// import { Injectable } from '@angular/core';
// import { BehaviorSubject } from 'rxjs';

// export interface ToastMessage {
//   id: string;
//   message: string;
//   type: 'success' | 'error' | 'info' | 'warning';
//   duration?: number;
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class ToastService {
//   private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
//   public toasts$ = this.toastsSubject.asObservable();

//   showSuccess(message: string, duration: number = 5000): void {
//     this.addToast({
//       id: this.generateId(),
//       message,
//       type: 'success',
//       duration
//     });
//   }

//   showError(message: string, duration: number = 5000): void {
//     this.addToast({
//       id: this.generateId(),
//       message,
//       type: 'error',
//       duration
//     });
//   }

//   showInfo(message: string, duration: number = 5000): void {
//     this.addToast({
//       id: this.generateId(),
//       message,
//       type: 'info',
//       duration
//     });
//   }

//   showWarning(message: string, duration: number = 5000): void {
//     this.addToast({
//       id: this.generateId(),
//       message,
//       type: 'warning',
//       duration
//     });
//   }

//   removeToast(id: string): void {
//     const currentToasts = this.toastsSubject.value;
//     const updatedToasts = currentToasts.filter(toast => toast.id !== id);
//     this.toastsSubject.next(updatedToasts);
//   }

//   private addToast(toast: ToastMessage): void {
//     const currentToasts = this.toastsSubject.value;
//     this.toastsSubject.next([...currentToasts, toast]);

//     // Auto-remove toast after duration
//     if (toast.duration) {
//       setTimeout(() => {
//         this.removeToast(toast.id);
//       }, toast.duration);
//     }
//   }

//   private generateId(): string {
//     return Math.random().toString(36).substr(2, 9);
//   }
// }

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  /** ms */
  duration?: number;
  // --- internal runtime fields (managed by service) ---
  _startedAt?: number;
  _remaining?: number;
  _timeoutId?: any;
  _paused?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  /** Default 2000 ms */
  private DEFAULT_DURATION = 2000;

  show(
    message: string,
    type: ToastType = 'info',
    duration = this.DEFAULT_DURATION
  ): string {
    const toast: ToastMessage = {
      id: cryptoRandomId(),
      message,
      type,
      duration,
      _remaining: duration,
      _startedAt: Date.now(),
      _paused: false,
    };
    const list = this.toastsSubject.value;
    this.toastsSubject.next([...list, toast]);
    this.armTimer(toast);
    return toast.id;
  }

  showSuccess(msg: string, duration = this.DEFAULT_DURATION) {
    return this.show(msg, 'success', duration);
  }
  showError(msg: string, duration = this.DEFAULT_DURATION) {
    return this.show(msg, 'error', duration);
  }
  showInfo(msg: string, duration = this.DEFAULT_DURATION) {
    return this.show(msg, 'info', duration);
  }
  showWarning(msg: string, duration = this.DEFAULT_DURATION) {
    return this.show(msg, 'warning', duration);
  }

  removeToast(id: string): void {
    const list = this.toastsSubject.value;
    const t = list.find((x) => x.id === id);
    if (t?._timeoutId) clearTimeout(t._timeoutId);
    this.toastsSubject.next(list.filter((x) => x.id !== id));
  }

  pause(id: string) {
    const t = this.toastsSubject.value.find((x) => x.id === id);
    if (!t || t._paused) return;
    t._paused = true;
    if (t._timeoutId) clearTimeout(t._timeoutId);
    if (t._startedAt && t._remaining !== undefined) {
      const elapsed = Date.now() - t._startedAt;
      t._remaining = Math.max(
        0,
        (t._remaining ?? this.DEFAULT_DURATION) - elapsed
      );
    }
  }

  resume(id: string) {
    const t = this.toastsSubject.value.find((x) => x.id === id);
    if (!t || !t._paused) return;
    t._paused = false;
    t._startedAt = Date.now();
    this.armTimer(t);
  }

  private armTimer(toast: ToastMessage) {
    if ((toast._remaining ?? 0) <= 0) {
      this.removeToast(toast.id);
      return;
    }
    toast._startedAt = Date.now();
    toast._timeoutId = setTimeout(
      () => this.removeToast(toast.id),
      toast._remaining
    );
  }
}

/** Better ID than Math.random */
function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return (a[0].toString(36) + a[1].toString(36)).slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}
