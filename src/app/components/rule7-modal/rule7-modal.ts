import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { BollardValidationResponse } from '../../services/viewer-measure.service';
import { ViewerService } from '../../services/viewer.service';

@Component({
  selector: 'app-rule7-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rule7-modal.html',
  styleUrl: './rule7-modal.scss',
})
export class Rule7ModalComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() analysisComplete = new EventEmitter<BollardValidationResponse>();

  loading = false;
  error: string = '';
  validationResults: BollardValidationResponse | null = null;

  constructor(private viewerService: ViewerService) {}

  ngOnInit() {
    // Reset state when modal opens
    this.resetState();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && changes['isVisible'].currentValue) {
      // Reset state when modal becomes visible
      this.resetState();
    }
  }

  private resetState() {
    this.loading = false;
    this.error = '';
    this.validationResults = null;
  }

  onClose() {
    this.resetState();
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  async onContinue() {
    console.log(
      '[Rule7Modal] Continue button clicked - starting bollard analysis'
    );
    this.loading = true;
    this.error = '';
    this.validationResults = null;

    try {
      const viewer = this.viewerService.getViewer();
      if (!viewer) {
        throw new Error('Viewer not available');
      }

      const result = await this.viewerService.measureBollardDistances(viewer, {
        select: false,
        onlyLeaves: true,
        category: 'Specialty Equipment',
        family: 'TS_Square Bollard',
        typeValue: 'Bollard',
        pairing: 'chain', // Use chain adjacency for L-shape layouts
        minOverlapXY: 5, // mm
        minOverlapZ: 5, // mm
        lineTolMM: 3, // mm bucketing
      });

      console.log('[Rule7Modal] Bollard analysis completed:', result);
      console.log(
        `[Rule7Modal] Found ${result.directed.length} directed pairs and ${result.unique.length} unique pairs`
      );

      if (result.validation) {
        this.validationResults = result.validation;
        console.log('[Rule7Modal] Validation Results:', this.validationResults);

        // Emit the validation results and close the modal
        this.analysisComplete.emit(this.validationResults);
        this.onClose();
      }
    } catch (error) {
      console.error('[Rule7Modal] Error during bollard analysis:', error);
      this.error =
        error instanceof Error ? error.message : 'Unknown error occurred';
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    this.onClose();
  }
}
