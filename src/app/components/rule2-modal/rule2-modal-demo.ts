import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Rule2ModalComponent } from './rule2-modal';

@Component({
  selector: 'app-rule2-modal-demo',
  standalone: true,
  imports: [CommonModule, Rule2ModalComponent],
  template: `
    <div class="demo-container">
      <h2>Rule2 Modal Demo</h2>
      <button (click)="showModal()" class="demo-button">
        Show Parking Accessibility Modal
      </button>

      <app-rule2-modal
        [isVisible]="isModalVisible"
        [validationData]="demoData"
        [loading]="false"
        [error]="''"
        [issuesCreated]="0"
        [highlight]="false"
        (close)="hideModal()"
        (showAccIssues)="onShowAccIssues()"
        (cdpdClick)="onCdpdClick()"
        (retry)="onRetry()"
      ></app-rule2-modal>
    </div>
  `,
  styles: [
    `
      .demo-container {
        padding: 20px;
        text-align: center;
      }

      .demo-button {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .demo-button:hover {
        background-color: #0056b3;
      }
    `,
  ],
})
export class Rule2ModalDemoComponent {
  isModalVisible = false;

  // Demo data based on the provided JSON
  demoData = {
    validationResults: [
      {
        typeId: 'parking_accessibility_validation',
        typeName: 'Parking Accessibility Compliance',
        familyName: 'Handicapped Parking Requirements',
        widthMm: 0,
        isValid: true,
        elementIds: [],
      },
    ],
    parkingAnalysis: {
      totalParkingSpaces: 63,
      normalParkingSpaces: 61,
      handicappedParkingSpaces: 2,
      requiredHandicappedSpaces: 2,
      actualHandicappedSpaces: 2,
      shortfall: 0,
      isValidationPassed: true,
      validationMessage:
        'PASSED: 2 handicapped spaces provided (2 required for 61 normal spaces)',
    },
  };

  showModal() {
    this.isModalVisible = true;
  }

  hideModal() {
    this.isModalVisible = false;
  }

  onShowAccIssues() {
    console.log('Show ACC Issues clicked');
    // Handle showing ACC issues
  }

  onCdpdClick() {
    console.log('CDPD button clicked');
    // Handle highlighting failed elements
  }

  onRetry() {
    console.log('Retry clicked');
    // Handle retry logic
  }
}
