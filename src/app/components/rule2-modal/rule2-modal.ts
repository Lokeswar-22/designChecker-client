import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

interface ValidationResult {
  typeId: string;
  typeName: string;
  familyName: string;
  widthMm: number;
  isValid: boolean;
  elementIds: string[];
}

interface ParkingAnalysis {
  totalParkingSpaces: number;
  normalParkingSpaces: number;
  handicappedParkingSpaces: number;
  requiredHandicappedSpaces: number;
  actualHandicappedSpaces: number;
  shortfall: number;
  isValidationPassed: boolean;
  validationMessage: string;
}

interface Rule2ValidationData {
  validationResults: ValidationResult[];
  parkingAnalysis: ParkingAnalysis;
}

@Component({
  selector: 'app-rule2-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rule2-modal.html',
  styleUrl: './rule2-modal.scss',
})
export class Rule2ModalComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Input() validationData: Rule2ValidationData | null = null;
  @Input() loading: boolean = false;
  @Input() error: string = '';
  @Input() issuesCreated: number = 0;
  @Input() highlight: boolean = false;

  @Output() close = new EventEmitter<void>();
  @Output() showAccIssues = new EventEmitter<void>();
  @Output() cdpdClick = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();

  constructor() {}

  ngOnInit() {}

  onClose() {
    this.close.emit();
  }

  onShowAccIssues() {
    this.showAccIssues.emit();
  }

  onCdpdClick() {
    this.cdpdClick.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onRetry() {
    this.retry.emit();
  }

  // Helper methods for calculations
  getHandicappedPercentage(): number {
    if (!this.validationData?.parkingAnalysis) return 0;
    const { handicappedParkingSpaces, totalParkingSpaces } =
      this.validationData.parkingAnalysis;
    return totalParkingSpaces > 0
      ? (handicappedParkingSpaces / totalParkingSpaces) * 100
      : 0;
  }

  getComplianceStatus(): string {
    if (!this.validationData?.parkingAnalysis) return 'UNKNOWN';
    return this.validationData.parkingAnalysis.isValidationPassed
      ? 'COMPLIANT'
      : 'NON-COMPLIANT';
  }

  getRequirementStatus(): string {
    if (!this.validationData?.parkingAnalysis) return 'UNKNOWN';
    return this.validationData.parkingAnalysis.shortfall === 0
      ? 'MET'
      : 'NOT MET';
  }
}
