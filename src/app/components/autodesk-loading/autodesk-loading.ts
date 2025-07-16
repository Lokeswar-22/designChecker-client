import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-autodesk-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './autodesk-loading.html',
  styleUrl: './autodesk-loading.scss'
})
export class AutodeskLoadingComponent {
  @Input() isVisible = false;
  @Input() message = 'Connecting to Autodesk...';
  @Output() manualCheck = new EventEmitter<void>();

  onManualCheck() {
    this.manualCheck.emit();
  }
} 