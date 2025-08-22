// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { ToastService, ToastMessage } from '../../services/toast.service';
// import { Subscription } from 'rxjs';

// @Component({
//   selector: 'app-toast',
//   standalone: true,
//   imports: [CommonModule],
//   template: `
//     <div class="toast-container">
//       <div
//         *ngFor="let toast of toasts"
//         class="toast"
//         [ngClass]="'toast-' + toast.type"
//         (click)="removeToast(toast.id)"
//       >
//         <div class="toast-content">
//           <span class="toast-message">{{ toast.message }}</span>
//           <button class="toast-close" (click)="removeToast(toast.id)">×</button>
//         </div>
//       </div>
//     </div>
//   `,
//   styles: [`
//     .toast-container {
//       position: fixed;
//       top: 20px;
//       right: 20px;
//       z-index: 9999;
//       display: flex;
//       flex-direction: column;
//       gap: 10px;
//     }

//     .toast {
//       min-width: 300px;
//       max-width: 400px;
//       padding: 12px 16px;
//       border-radius: 8px;
//       box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
//       cursor: pointer;
//       animation: slideIn 0.3s ease-out;
//       transition: all 0.3s ease;
//     }

//     .toast:hover {
//       transform: translateX(-5px);
//     }

//     .toast-success {
//       background-color: #d4edda;
//       color: #155724;
//       border-left: 4px solid #28a745;
//     }

//     .toast-error {
//       background-color: #f8d7da;
//       color: #721c24;
//       border-left: 4px solid #dc3545;
//     }

//     .toast-info {
//       background-color: #d1ecf1;
//       color: #0c5460;
//       border-left: 4px solid #17a2b8;
//     }

//     .toast-warning {
//       background-color: #fff3cd;
//       color: #856404;
//       border-left: 4px solid #ffc107;
//     }

//     .toast-content {
//       display: flex;
//       justify-content: space-between;
//       align-items: center;
//     }

//     .toast-message {
//       flex: 1;
//       margin-right: 10px;
//     }

//     .toast-close {
//       background: none;
//       border: none;
//       font-size: 18px;
//       cursor: pointer;
//       opacity: 0.7;
//       transition: opacity 0.2s;
//     }

//     .toast-close:hover {
//       opacity: 1;
//     }

//     @keyframes slideIn {
//       from {
//         transform: translateX(100%);
//         opacity: 0;
//       }
//       to {
//         transform: translateX(0);
//         opacity: 1;
//       }
//     }
//   `]
// })
// export class ToastComponent implements OnInit, OnDestroy {
//   toasts: ToastMessage[] = [];
//   private subscription: Subscription = new Subscription();

//   constructor(private toastService: ToastService) {}

//   ngOnInit() {
//     this.subscription = this.toastService.toasts$.subscribe(toasts => {
//       this.toasts = toasts;
//     });
//   }

//   ngOnDestroy() {
//     this.subscription.unsubscribe();
//   }

//   removeToast(id: string) {
//     this.toastService.removeToast(id);
//   }
// }

import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastMessage, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('toastAnim', [
      state(
        'enter',
        style({ opacity: 1, transform: 'translateX(0) scale(1)' })
      ),
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(20px) scale(0.98)' }),
        animate('180ms cubic-bezier(.2,.8,.2,1)'),
      ]),
      transition(':leave', [
        animate(
          '200ms ease',
          style({ opacity: 0, transform: 'translateX(10px) scale(0.98)' })
        ),
      ]),
    ]),
  ],
  template: `
    <div class="toast-container" role="region" aria-label="Notifications">
      <div
        *ngFor="let toast of toasts; trackBy: trackById"
        [@toastAnim]
        class="toast"
        [ngClass]="'toast-' + toast.type"
        role="status"
        aria-live="polite"
        (mouseenter)="onHover(toast)"
        (mouseleave)="onLeave(toast)"
      >
        <div class="toast-content">
          <div class="toast-icon" aria-hidden="true">
            <span [ngClass]="iconClass(toast.type)"></span>
          </div>
          <div class="toast-message">{{ toast.message }}</div>
          <button
            class="toast-close"
            type="button"
            aria-label="Dismiss"
            (click)="dismiss(toast.id); $event.stopPropagation()"
          >
            ×
          </button>
        </div>

        <!-- Progress bar -->
        <div class="toast-progress">
          <div
            class="toast-progress-bar"
            [style.animation-duration.ms]="progressDuration(toast)"
            [style.animation-play-state]="toast._paused ? 'paused' : 'running'"
          ></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        pointer-events: none;
      } /* let clicks through except on toasts */
      .toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647; /* stay on top */
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: min(92vw, 380px);
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        padding: 12px 12px 8px;
        backdrop-filter: saturate(1.2) blur(4px);
        background: #111827; /* base */
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transform-origin: right center;
      }
      .toast-content {
        display: grid;
        grid-template-columns: 20px 1fr auto;
        align-items: center;
        gap: 10px;
      }
      .toast-message {
        font-size: 14px;
        line-height: 1.35;
      }
      .toast-close {
        background: transparent;
        border: 0;
        color: inherit;
        font-size: 18px;
        opacity: 0.8;
        cursor: pointer;
        transition: transform 0.12s ease, opacity 0.12s ease;
      }
      .toast-close:hover {
        opacity: 1;
        transform: scale(1.05);
      }

      /* Types */
      .toast-success {
        border-left: 4px solid #22c55e;
        background: #052e1a;
      }
      .toast-error {
        border-left: 4px solid #ef4444;
        background: #2a0b0b;
      }
      .toast-info {
        border-left: 4px solid #3b82f6;
        background: #0a2447;
      }
      .toast-warning {
        border-left: 4px solid #f59e0b;
        background: #3a2402;
      }

      .toast-icon::before {
        content: '';
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        box-shadow: 0 0 0 2px currentColor inset;
      }
      .icon-success {
        color: #22c55e;
      }
      .icon-error {
        color: #ef4444;
      }
      .icon-info {
        color: #3b82f6;
      }
      .icon-warning {
        color: #f59e0b;
      }

      /* Progress */
      .toast-progress {
        height: 3px;
        margin-top: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.15);
        overflow: hidden;
      }
      .toast-progress-bar {
        height: 100%;
        width: 100%;
        background: rgba(255, 255, 255, 0.85);
        transform-origin: left center;
        animation-name: shrink;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }
      @keyframes shrink {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }

      /* Hover lift */
      .toast:hover {
        transform: translateX(-4px) scale(1.01);
      }

      /* Compact on small screens */
      @media (max-width: 480px) {
        .toast {
          padding: 10px 10px 6px;
        }
        .toast-message {
          font-size: 13px;
        }
      }
    `,
  ],
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private sub = new Subscription();

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.sub = this.toastService.toasts$.subscribe(
      (list) => (this.toasts = list)
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  dismiss(id: string) {
    this.toastService.removeToast(id);
  }

  onHover(t: ToastMessage) {
    this.toastService.pause(t.id);
  }
  onLeave(t: ToastMessage) {
    this.toastService.resume(t.id);
  }

  progressDuration(t: ToastMessage) {
    // Remaining time for progress animation (ms)
    const rem = t._paused
      ? t._remaining
      : Math.max(0, (t._remaining ?? 0) - (Date.now() - (t._startedAt ?? 0)));
    return Math.max(0, rem ?? 0);
  }

  iconClass(type: ToastMessage['type']) {
    return {
      'icon-success': type === 'success',
      'icon-error': type === 'error',
      'icon-info': type === 'info',
      'icon-warning': type === 'warning',
    };
  }

  trackById(_: number, t: ToastMessage) {
    return t.id;
  }

  /** Optional: Dismiss top toast on ESC */
  @HostListener('document:keydown.escape')
  onEsc() {
    const last = this.toasts[this.toasts.length - 1];
    if (last) this.dismiss(last.id);
  }
}
