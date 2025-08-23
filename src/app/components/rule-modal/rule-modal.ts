import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LocalService } from '../../services/local.service';
import { RuleCheckResponse, RuleService } from '../../services/rule.service';
import { ToastService } from '../../services/toast.service';
import { ViewerService } from '../../services/viewer.service';

interface RuleInfo {
  title: string;
  description: string;
  executionInfo: string;
  category: string;
  thresholds: {
    minimum:
      | number
      | string
      | { clearWidth: number; transferZone: { width: number; depth: number } }
      | null;
    maximum: number | string | null;
    unit: string | null;
    requirement: string | null;
  };
  thresholdsTable?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
}

interface ValidationResult {
  typeId: string;
  typeName: string;
  familyName: string;
  widthMm: number;
  isValid: boolean;
  elementIds: string[];
}

interface ValidationSummary {
  totalTypesChecked: number;
  failedValidations: number;
  failedWithElementIds: number;
  failedWithoutElementIds: number;
  totalFailedElementInstances: number;
  uniqueElementIds: number;
  duplicateElementIds: number;
  perfectMatchesFound: number;
  totalInstancesChecked?: number;
  compliancePercent?: number;
  handicappedPercentOfTotal?: number;
}

interface FailureBreakdown {
  [key: string]: number;
}

interface ValidationResponse {
  validationResults: ValidationResult[];
  summary: ValidationSummary;
  failureBreakdown: FailureBreakdown;
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

interface ParkingBreakdown {
  [key: string]: {
    count: number;
    elementIds: string[];
  };
}

interface Rule3Response extends ValidationResponse {
  parkingAnalysis: ParkingAnalysis;
  normalParkingBreakdown: ParkingBreakdown;
  handicappedParkingBreakdown: ParkingBreakdown;
}

@Component({
  selector: 'app-rule-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rule-modal.html',
  styleUrl: './rule-modal.scss',
})
export class RuleModalComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Input() elementGroupId: string = '';
  @Input() accUserId: string = '';
  @Input() ruleType: string = 'rule1';
  @Output() close = new EventEmitter<void>();
  @Output() showAccIssues = new EventEmitter<number>();
  projectId: string | null = null;

  loading = false;
  ruleData: RuleCheckResponse | null = null;
  validationData: ValidationResponse | null = null;
  rule2Data: Rule3Response | null = null;
  error: string = '';
  urn: string = '';

  showAcknowledgement = true;
  highlight = false;

  ruleInfo: RuleInfo = {
    title: '',
    description: '',
    executionInfo: '',
    category: '',
    thresholds: {
      minimum: null,
      maximum: null,
      unit: null,
      requirement: null,
    },
  };

  constructor(
    private ruleService: RuleService,
    private localService: LocalService,
    private viewerService: ViewerService,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.setupRuleInfo();

    const projectName = this.localService.getProjectName();

    if (projectName && this.accUserId) {
      this.ruleService.getProjectById(this.accUserId, projectName).subscribe({
        next: (response) => {
          this.projectId = response.projectId.split('.')[1];
        },
        error: () => {
          this.error = 'Error calling project by ID API.';
        },
      });
    }

    this.route.queryParams.subscribe((queryParams) => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(
            decodeURIComponent(queryParams['alternativeIdentifiers'])
          );
          this.urn = alternativeIdentifiers.fileUrn;
        } catch {
          this.error = 'Error parsing alternativeIdentifiers.';
        }
      }
    });
  }

  ngOnChanges() {
    if (this.isVisible) {
      this.showAcknowledgement = true;
      this.loading = false;
      this.error = '';
      this.ruleData = null;
      this.validationData = null;
      this.rule2Data = null;
      this.highlight = false;
      this.setupRuleInfo();
      this.viewerService.clearFailedElementsVisuals();
      this.viewerService.clearProcessedRevitIds();
    }
  }

  setupRuleInfo() {
    switch (this.ruleType) {
      case 'rule1':
        this.ruleInfo = {
          title: 'Rule 1 – Door Width',
          description:
            'Validates every door instance for minimum clear width. The rule first looks for a width value on the instance; if missing, it falls back to the door type. If no width is found anywhere, the instance fails.',
          executionInfo:
            '1) Filter all door INSTANCES from the AEC Data Model.\n' +
            '2) For each instance, attempt to read its "Width" parameter.\n' +
            '3) If the instance has no width, look up the instance`s Family/Type and read the Type "Width".\n' +
            '4) If a width is found (from instance or type), check width ≥ 850 mm → PASS, else FAIL.\n' +
            '5) If no width is found in either place, mark as FAIL.\n' +
            '6) Create ACC issues for all failed elements.',
          category: 'Doors',
          thresholds: {
            minimum: 850,
            maximum: null,
            unit: 'mm',
            requirement:
              'Door width (instance "Width" or fallback Type "Width") must be ≥ 850 mm. If "Width" is missing on both instance and type, the element FAILS.',
          },
        };
        break;

      case 'rule2':
        this.ruleInfo = {
          title: 'Rule 2 - Parking Accessibility Compliance',
          description:
            'Validates that sufficient handicapped parking spaces are provided based on the total number of normal parking spaces.',
          executionInfo:
            'Fetches parking data by level. Counts total, normal, and handicapped parking spaces (identifies HCP/Handicapped in names). Validates compliance with accessibility requirements and calculates shortfall if needed.',
          category: 'Parking',
          thresholds: {
            minimum: 'Variable based on normal spaces',
            maximum: null,
            unit: 'handicapped spaces required',
            requirement:
              '1-50: 1 required, 51-100: 2 required, 101-300: 3 required, 301-500: 4 required, >500: 4 + (additional÷200)',
          },
          thresholdsTable: {
            headers: [
              'Number of vehicle parking lots',
              'Number of accessible lots',
            ],
            rows: [
              ['0 to 50', 1],
              ['more than 50 to 100', 2],
              ['more than 100 to 300', 3],
              ['Exceeding 300', '4 + 1 for every additional 200'],
            ],
          },
        };
        break;

      case 'rule3':
        this.ruleInfo = {
          title: 'Rule 3 - Ramp Width Check',
          description:
            'Ensures ramps have a minimum width of 1200mm for accessibility compliance.',
          executionInfo:
            'Fetches ramp elements and validates their width. Checks if the ramp width meets the minimum requirement of 1200mm for accessibility standards.',
          category: 'Ramps',
          thresholds: {
            minimum: 1200,
            maximum: null,
            unit: 'mm',
            requirement:
              'Ramp width must be at least 1200mm to meet accessibility requirements',
          },
        };
        break;

      case 'rule4':
        this.ruleInfo = {
          title: 'Rule 4 - Staircase Riser Height',
          description:
            'Validates that staircase riser height does not exceed the maximum allowed height for safety and accessibility.',
          executionInfo:
            'Fetches stair elements (category = Stairs) and checks the riser height. Validates that the maximum riser height is less than 175mm to ensure safe and accessible stair design.',
          category: 'Stairs',
          thresholds: {
            minimum: null,
            maximum: 175,
            unit: 'mm',
            requirement:
              'Staircase riser height must not exceed 175mm for safety and accessibility compliance',
          },
        };
        break;

      case 'rule5':
        this.ruleInfo = {
          title: 'Rule 5 - Lift length and width  validation',
          description:
            'Validates lifts assumed as rectangles by calculating length and width from area and perimeter. Ensures minimum width of 1200 mm and minimum length of 1500 mm to comply with accessibility standards. Flags failures with detailed reasons tied to specific room elements.',
          executionInfo:
            'Fetches room instances with area and perimeter properties. Calculates rectangle dimensions using geometric formulas from area/perimeter data. Validates room dimensions against accessibility thresholds. Reports failures with element IDs for remediation.',
          category: 'Accessibility / Space Validation',
          thresholds: {
            minimum: 1200,
            maximum: 1500,
            unit: 'mm',
            requirement:
              'Lifts must have a minimum clear width of 1200 mm and minimum length of 1500 mm as derived from area and perimeter to ensure accessibility compliance.',
          },
        };
        break;

      default:
        this.ruleInfo = {
          title: 'Rule Check',
          description:
            'This rule performs compliance checking on building elements.',
          executionInfo:
            'The system will analyze elements and create ACC issues for non-compliant items.',
          category: 'General',
          thresholds: {
            minimum: null,
            maximum: null,
            unit: null,
            requirement: 'Generic compliance check',
          },
        };
    }
  }

  onContinue() {
    this.showAcknowledgement = false;
    this.checkRule();
  }

  onCancel() {
    this.onClose();
  }

  checkRule() {
    this.loading = true;
    this.error = '';
    this.ruleData = null;
    this.highlight = false;

    this.viewerService.clearFailedElementsVisuals();
    this.viewerService.clearProcessedRevitIds();

    if (this.ruleType === 'rule1') {
      this.checkRule1();
    } else if (this.ruleType === 'rule2') {
      this.checkRule2();
    } else if (this.ruleType === 'rule3') {
      this.checkRule3();
    } else if (this.ruleType === 'rule4') {
      this.checkRule4();
    } else if (this.ruleType === 'rule5') {
      this.checkRule5();
    }
  }

  checkRule1() {
    this.ruleService
      .checkRule1(this.elementGroupId, this.accUserId, this.projectId!)
      .subscribe({
        next: async (response: RuleCheckResponse) => {
          this.ruleData = response;

          if (response && response.validationResults) {
            try {
              this.validationData = {
                validationResults: response.validationResults,
                summary: response.summary as any,
                failureBreakdown: response.failureBreakdown,
              };

              if (
                !this.validationData.validationResults ||
                !this.validationData.summary
              ) {
                this.validationData = null;
              }
            } catch {
              this.validationData = null;
            }
          }

          this.loading = false;
          await this.getFailedElements();
        },
        error: () => {
          this.error = 'Failed to check rule 1. Please try again.';
          this.loading = false;
        },
      });
  }

  checkRule2() {
    this.ruleService
      .checkRule2(this.elementGroupId, this.accUserId, this.projectId!)
      .subscribe({
        next: async (response: RuleCheckResponse) => {
          this.ruleData = response;

          if (response && response.validationResults) {
            this.rule2Data = response as unknown as Rule3Response;

            try {
              this.validationData = {
                validationResults: response.validationResults,
                summary: response.summary as any,
                failureBreakdown: response.failureBreakdown,
              };

              if (
                !this.validationData.validationResults ||
                !this.validationData.summary
              ) {
                this.validationData = null;
              }
            } catch {
              this.validationData = null;
            }
          }

          this.loading = false;
          await this.getFailedElements();
        },
        error: () => {
          this.error = 'Failed to check rule 1. Please try again.';
          this.loading = false;
        },
      });
  }

  checkRule3() {
    const LevelName = 'BASEMENT';
    this.ruleService
      .checkRule3(
        this.elementGroupId,
        this.accUserId,
        this.projectId!,
        LevelName!
      )
      .subscribe({
        next: async (response: RuleCheckResponse) => {
          this.ruleData = response;

          if (
            response &&
            response.validationResults &&
            (response as any).parkingAnalysis
          ) {
            try {
              this.validationData = {
                validationResults: response.validationResults,
                summary: response.summary as any,
                failureBreakdown: response.failureBreakdown,
              };
            } catch {
              this.validationData = null;
            }
          } else if (response && response.validationResults) {
            try {
              this.validationData = {
                validationResults: response.validationResults,
                summary: response.summary as any,
                failureBreakdown: response.failureBreakdown,
              };
            } catch {
              this.validationData = null;
            }
          }

          this.loading = false;
          await this.getFailedElements();
        },
        error: () => {
          this.error = 'Failed to check rule 3. Please try again.';
          this.loading = false;
        },
      });
  }

  checkRule4() {
    this.ruleService
      .checkRule4(this.elementGroupId, this.accUserId, this.projectId!)
      .subscribe({
        next: async (response: RuleCheckResponse) => {
          this.ruleData = response;

          if (response && response.validationResults) {
            try {
              this.validationData = {
                validationResults: response.validationResults,
                summary: response.summary as any,
                failureBreakdown: response.failureBreakdown,
              };

              if (
                !this.validationData.validationResults ||
                !this.validationData.summary
              ) {
                this.validationData = null;
              }
            } catch {
              this.validationData = null;
            }
          }

          this.loading = false;
          await this.getFailedElements();
        },
        error: () => {
          this.error = 'Failed to check rule 1. Please try again.';
          this.loading = false;
        },
      });
  }

  checkRule5() {
    this.ruleService
      .checkRule5(this.elementGroupId, this.accUserId, this.projectId!)
      .subscribe({
        next: async (response: RuleCheckResponse) => {
          this.ruleData = response;

          if (response && response.validationResults) {
            try {
              this.validationData = {
                validationResults: response.validationResults,
                summary: response.summary as any,
                failureBreakdown: response.failureBreakdown,
              };

              if (
                !this.validationData.validationResults ||
                !this.validationData.summary
              ) {
                this.validationData = null;
              }
            } catch {
              this.validationData = null;
            }
          }

          this.loading = false;
          await this.getFailedElements();
        },
        error: () => {
          this.error = 'Failed to check rule 1. Please try again.';
          this.loading = false;
        },
      });
  }

  onClose() {
    this.viewerService.clearFailedElementsVisuals();
    this.viewerService.clearProcessedRevitIds();
    this.highlight = false;
    this.close.emit();
  }

  async onCdpdClick() {
    this.viewerService.highlightFailedElements();
    this.onClose();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getPassedCount(): number {
    if (
      this.validationData &&
      this.validationData.summary &&
      this.validationData.summary.totalInstancesChecked !== undefined &&
      this.validationData.summary.totalFailedElementInstances !== undefined
    ) {
      return (
        this.validationData.summary.totalInstancesChecked -
        this.validationData.summary.totalFailedElementInstances
      );
    }

    if (this.rule2Data && this.ruleType === 'rule2') {
      // For Rule2, passed count is the total parking spaces if validation passed
      if (this.rule2Data.parkingAnalysis?.isValidationPassed) {
        return this.rule2Data.parkingAnalysis.totalParkingSpaces || 0;
      }
      return 0;
    } else if (this.validationData) {
      return (
        this.validationData.summary.totalTypesChecked -
        this.validationData.summary.failedValidations
      );
    } else if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.summary?.totalPassed || 0;
    } else {
      return this.ruleData?.summary?.totalPassed || 0;
    }
  }

  getFailedCount(): number {
    if (
      this.validationData &&
      this.validationData.summary &&
      this.validationData.summary.totalFailedElementInstances !== undefined
    ) {
      return this.validationData.summary.totalFailedElementInstances;
    }

    if (this.rule2Data && this.ruleType === 'rule2') {
      // For Rule2, failed count is 0 if validation passed, otherwise total spaces
      if (this.rule2Data.parkingAnalysis?.isValidationPassed) {
        return 0;
      }
      return this.rule2Data.parkingAnalysis?.totalParkingSpaces || 0;
    } else if (this.validationData) {
      return this.validationData.summary.failedValidations;
    } else if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.summary?.totalFailed || 0;
    } else {
      return this.ruleData?.summary?.totalFailed || 0;
    }
  }

  getTotalCount(): number {
    if (
      this.validationData &&
      this.validationData.summary &&
      this.validationData.summary.totalInstancesChecked
    ) {
      return this.validationData.summary.totalInstancesChecked;
    }

    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      return this.rule2Data.parkingAnalysis?.totalParkingSpaces || 0;
    } else if (this.validationData) {
      return this.validationData.summary?.totalTypesChecked || 0;
    } else if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.summary?.totalElementsChecked || 0;
    } else {
      return this.ruleData?.summary?.totalElementsChecked || 0;
    }
  }

  getPassPercentage(): number {
    if (this.ruleType === 'rule2') {
      // For rule2, calculate pass rate based on handicapped parking ratio percentage
      if (this.rule2Data && this.rule2Data.parkingAnalysis) {
        const {
          totalParkingSpaces,
          handicappedParkingSpaces,
          requiredHandicappedSpaces,
        } = this.rule2Data.parkingAnalysis;
        if (totalParkingSpaces > 0) {
          const actualRatio =
            (handicappedParkingSpaces / totalParkingSpaces) * 100;
          const requiredRatio =
            (requiredHandicappedSpaces / totalParkingSpaces) * 100;
          // Pass rate is based on meeting the required ratio
          return actualRatio >= requiredRatio
            ? 100
            : Math.round((actualRatio / requiredRatio) * 100);
        }
      }
      // Fallback to original logic if parking analysis not available
      const total = this.getTotalCount();
      if (total === 0) return 0;
      return Math.round((this.getPassedCount() / total) * 100);
    } else if (this.ruleType === 'rule3') {
      const total = this.getTotalCount();
      if (total === 0) return 0;
      return Math.round((this.getPassedCount() / total) * 100);
    }

    if (this.validationData && this.validationData.summary) {
      const totalInstancesChecked =
        this.validationData.summary.totalInstancesChecked || 0;
      const totalFailedElementInstances =
        this.validationData.summary.totalFailedElementInstances || 0;

      if (totalInstancesChecked === 0) return 0;

      const passedInstances =
        totalInstancesChecked - totalFailedElementInstances;
      return Math.round((passedInstances / totalInstancesChecked) * 100);
    }

    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getPassedCount() / total) * 100);
  }

  getCompliancePercentage(): number {
    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      if (this.rule2Data.parkingAnalysis) {
        // Calculate compliance percentage based on parking analysis
        const {
          totalParkingSpaces,
          handicappedParkingSpaces,
          requiredHandicappedSpaces,
        } = this.rule2Data.parkingAnalysis;
        if (totalParkingSpaces > 0) {
          const compliance =
            (handicappedParkingSpaces / requiredHandicappedSpaces) * 100;
          return Math.min(compliance, 100); // Cap at 100%
        }
      }
      if (this.rule2Data.summary) {
        return this.rule2Data.summary.compliancePercent || 0;
      }
    }
    return 0;
  }

  getHandicappedPercentage(): number {
    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      if (this.rule2Data.parkingAnalysis) {
        // Calculate handicapped percentage from parking analysis
        const { totalParkingSpaces, handicappedParkingSpaces } =
          this.rule2Data.parkingAnalysis;
        if (totalParkingSpaces > 0) {
          return Number(
            ((handicappedParkingSpaces / totalParkingSpaces) * 100).toFixed(2)
          );
        }
      }
      if (this.rule2Data.summary) {
        return this.rule2Data.summary.handicappedPercentOfTotal || 0;
      }
    }
    return 0;
  }

  getParkingRangeText(index: number): string {
    if (this.ruleType !== 'rule3' || !this.ruleInfo.thresholdsTable) return '';

    const rows = this.ruleInfo.thresholdsTable.rows;
    if (index === 0) {
      return `First ${rows[0][0]} lots (1-${rows[0][0]})`;
    } else if (index === 1) {
      const current = rows[1][0] as number;
      const previous = rows[0][0] as number;
      const range = current - previous;
      return `Next ${range} lots (${previous + 1}-${current})`;
    } else if (index === 2) {
      const current = rows[2][0] as number;
      const previous = rows[1][0] as number;
      const range = current - previous;
      return `Next ${range} lots (${previous + 1}-${current})`;
    } else if (index === 3) {
      const current = rows[3][0] as number;
      const previous = rows[2][0] as number;
      const range = current - previous;
      return `Next ${range} lots (${previous + 1}-${current})`;
    }
    return '';
  }

  getAccessibleLotsCount(index: number): number {
    if (this.ruleType !== 'rule3' || !this.ruleInfo.thresholdsTable) return 0;
    return this.ruleInfo.thresholdsTable.rows[index][1] as number;
  }

  getIssuesCreated(): number {
    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      return 0;
    }
    return this.ruleData?.issuesCreated || 0;
  }

  getResults(): any[] {
    if (this.rule2Data && this.ruleType === 'rule2') {
      // For Rule2 only, return empty array to hide detailed results
      // since the parking analysis section already shows all the information
      return [];
    } else if (this.rule2Data && this.ruleType === 'rule3') {
      // For Rule3, return parking breakdown results
      const results: any[] = [];

      if (this.rule2Data.normalParkingBreakdown) {
        Object.entries(this.rule2Data.normalParkingBreakdown).forEach(
          ([type, parking]) => {
            results.push({
              type: 'Normal Parking',
              parkingType: type,
              count: parking.count,
              elementIds: parking.elementIds,
              passed: true,
            });
          }
        );
      }

      if (this.rule2Data.handicappedParkingBreakdown) {
        Object.entries(this.rule2Data.handicappedParkingBreakdown).forEach(
          ([type, parking]) => {
            results.push({
              type: 'Handicapped Parking',
              parkingType: type,
              count: parking.count,
              elementIds: parking.elementIds,
              passed: true,
            });
          }
        );
      }

      return results;
    } else if (this.validationData) {
      return this.validationData.validationResults || [];
    } else if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.results || [];
    } else {
      return this.ruleData?.results || [];
    }
  }

  getValidationResults(): ValidationResult[] {
    return this.validationData?.validationResults || [];
  }

  getSummary(): ValidationSummary | null {
    return this.validationData?.summary || null;
  }

  getFailureBreakdown(): FailureBreakdown | null {
    return this.validationData?.failureBreakdown || null;
  }

  getParkingAnalysis(): ParkingAnalysis | null {
    return this.rule2Data?.parkingAnalysis || null;
  }

  getNormalParkingBreakdown(): ParkingBreakdown | null {
    return this.rule2Data?.normalParkingBreakdown || null;
  }

  getHandicappedParkingBreakdown(): ParkingBreakdown | null {
    return this.rule2Data?.handicappedParkingBreakdown || null;
  }

  isRule3(): boolean {
    return this.ruleType === 'rule3';
  }

  isRule2(): boolean {
    return this.ruleType === 'rule2';
  }

  isParkingRule(): boolean {
    return this.ruleType === 'rule2' || this.ruleType === 'rule3';
  }

  hasParkingData(): boolean {
    return (
      this.rule2Data !== null &&
      this.rule2Data?.parkingAnalysis !== undefined &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    );
  }

  getParkingSummary(): string {
    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      const analysis = this.rule2Data.parkingAnalysis;
      return (
        analysis?.validationMessage ||
        'Parking accessibility compliance check completed'
      );
    }
    return '';
  }

  getParkingDetails(): any {
    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      return {
        total: this.rule2Data.parkingAnalysis?.totalParkingSpaces || 0,
        normal: this.rule2Data.parkingAnalysis?.normalParkingSpaces || 0,
        handicapped:
          this.rule2Data.parkingAnalysis?.handicappedParkingSpaces || 0,
        required:
          this.rule2Data.parkingAnalysis?.requiredHandicappedSpaces || 0,
        shortfall: this.rule2Data.parkingAnalysis?.shortfall || 0,
        passed: this.rule2Data.parkingAnalysis?.isValidationPassed || false,
      };
    }
    return null;
  }

  isUsingValidationData(): boolean {
    // Rule2 uses parking analysis data, not validation data
    if (this.ruleType === 'rule2') {
      return false;
    }
    return this.validationData !== null;
  }

  hasEmptyResults(): boolean {
    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      const hasParkingData =
        this.rule2Data.parkingAnalysis &&
        (this.rule2Data.normalParkingBreakdown ||
          this.rule2Data.handicappedParkingBreakdown);
      return !hasParkingData;
    } else if (this.validationData) {
      const hasResults =
        this.validationData.validationResults &&
        this.validationData.validationResults.length > 0;
      return !hasResults;
    }

    const results = this.getResults();
    const serviceCheck = this.ruleService.isRuleResultEmpty(this.ruleData!);
    const isEmpty = results.length === 0 || serviceCheck;
    return isEmpty;
  }

  getEmptyResultsMessage(): string {
    if (this.ruleType === 'rule2' || this.ruleType === 'rule3') {
      return `No parking elements found in the selected group to validate this rule.`;
    }
    return `No ${this.ruleInfo.category.toLowerCase()} elements found in the selected group to validate this rule.`;
  }

  async getFailedElements(): Promise<Array<{ revitElementId: string }>> {
    let failedElements: Array<{ revitElementId: string }> = [];

    if (
      this.rule2Data &&
      (this.ruleType === 'rule2' || this.ruleType === 'rule3')
    ) {
      const allElementIds: string[] = [];

      if (this.rule2Data.normalParkingBreakdown) {
        Object.values(this.rule2Data.normalParkingBreakdown).forEach(
          (parking) => {
            allElementIds.push(...parking.elementIds);
          }
        );
      }

      if (this.rule2Data.handicappedParkingBreakdown) {
        Object.values(this.rule2Data.handicappedParkingBreakdown).forEach(
          (parking) => {
            allElementIds.push(...parking.elementIds);
          }
        );
      }

      this.highlight = true;
      return [];
    } else if (this.validationData) {
      const failedResults = this.validationData.validationResults.filter(
        (result) => !result.isValid
      );
      failedElements = failedResults.flatMap((result) =>
        result.elementIds.map((elementId) => ({
          revitElementId: elementId,
        }))
      );
    } else {
      const results = this.getResults();
      if (results.length === 0) {
        return [];
      }

      failedElements = results
        .filter((result) => !result.passed)
        .map((result) => ({
          revitElementId: result.revitElementId,
        }));
    }

    this.highlight = failedElements.length > 0;

    let successfulIssues = 0;
    let processedIssues = 0;
    const totalIssues = failedElements.length;

    const BATCH_SIZE = 10;
    const BATCH_DELAY = 1000;

    const showToastIfComplete = () => {
      processedIssues++;
      if (processedIssues === totalIssues) {
        if (successfulIssues > 0) {
          const message =
            successfulIssues === 1
              ? '1 issue created in ACC'
              : `${successfulIssues} issues created in ACC`;
          this.toastService.showSuccess(message);
        }
        this.highlight = true;
      }
    };

    const processBatch = async (batch: Array<{ revitElementId: string }>) => {
      const batchPromises = batch.map(async (element) => {
        const revitId = element.revitElementId;

        if (!revitId) {
          showToastIfComplete();
          return;
        }

        try {
          const processResult = await this.viewerService.processModel(revitId);

          if (processResult) {
            const result = this.generateIssuePayloadFromProcessResult(
              processResult,
              this.getResults()
            );

            this.ruleService
              .createIssue(this.projectId!, this.accUserId, result)
              .subscribe({
                next: () => {
                  successfulIssues++;
                  showToastIfComplete();
                },
                error: () => {
                  showToastIfComplete();
                },
              });
          } else {
            showToastIfComplete();
          }
        } catch {
          showToastIfComplete();
        }
      });

      await Promise.all(batchPromises);
    };

    const processAllBatches = async () => {
      for (let i = 0; i < failedElements.length; i += BATCH_SIZE) {
        const batch = failedElements.slice(i, i + BATCH_SIZE);
        await processBatch(batch);

        if (i + BATCH_SIZE < failedElements.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      }
    };

    processAllBatches().catch(() => {});

    return failedElements;
  }

  onShowAccIssues() {
    this.showAccIssues.emit(this.getIssuesCreated());
  }

  generateIssuePayloadFromProcessResult(processResult: any, results: any): any {
    const { position, objectId, externalId, viewerState, view } = processResult;

    let title = '';
    let description = '';

    if (this.rule2Data && this.ruleType === 'rule3') {
      let parkingType = '';
      let parkingName = '';

      for (const [type, parking] of Object.entries(
        this.rule2Data.normalParkingBreakdown
      )) {
        if ((parking as any).elementIds.includes(objectId)) {
          parkingType = 'Normal Parking';
          parkingName = type;
          break;
        }
      }

      if (!parkingType) {
        for (const [type, parking] of Object.entries(
          this.rule2Data.handicappedParkingBreakdown
        )) {
          if ((parking as any).elementIds.includes(objectId)) {
            parkingType = 'Handicapped Parking';
            parkingName = type;
            break;
          }
        }
      }

      if (parkingType) {
        title = `${parkingType} - ${view.name}`;
        description = `Parking Type: ${parkingName} - Parking accessibility compliance check`;
      } else {
        title = `Parking Element - ${view.name}`;
        description = `Parking accessibility compliance check`;
      }
    } else if (this.validationData) {
      const validationResult = this.validationData.validationResults.find(
        (result) => result.elementIds.includes(objectId)
      );

      if (validationResult) {
        title = `Validation Failed - ${view.name}`;
        description = `Type: ${validationResult.typeName}, Family: ${validationResult.familyName}, Width: ${validationResult.widthMm}mm - Failed validation check`;
      } else {
        title = `Validation Failed - ${view.name}`;
        description = `Element validation check failed`;
      }
    } else {
      if (this.ruleType === 'rule1') {
        title = `Failed - ${view.name}`;
        description = `${
          results.find(
            (result: { revitElementId: any }) =>
              result.revitElementId === objectId
          )?.message || 'Door clear opening check failed'
        }`;
      } else if (this.ruleType === 'rule2') {
        title = `Ramp Landing Failed - ${view.name}`;
        description = `${
          results.find(
            (result: { revitElementId: any }) =>
              result.revitElementId === objectId
          )?.message || 'Ramp landing check failed'
        }`;
      } else if (this.ruleType === 'rule3') {
        title = `Ramp Check Failed - ${view.name}`;
        description = `${
          results.find(
            (result: { revitElementId: any }) =>
              result.revitElementId === objectId
          )?.message || 'Ramp check failed'
        }`;
      } else if (this.ruleType === 'rule4') {
        title = `Stair Check Failed - ${view.name}`;
        description = `${
          results.find(
            (result: { revitElementId: any }) =>
              result.revitElementId === objectId
          )?.message || 'Stair check failed'
        }`;
      } else if (this.ruleType === 'rule5') {
        title = `Wall Check Failed - ${view.name}`;
        description = `${
          results.find(
            (result: { revitElementId: any }) =>
              result.revitElementId === objectId
          )?.message || 'Wall check failed'
        }`;
      }
    }

    return {
      title: title,
      description: description,
      issueSubtypeId: '0d960e5e-92af-4876-b514-aacbbadaca1e',
      status: 'open',
      assignedTo: this.accUserId.toString(),
      assignedToType: 'user',
      dueDate: new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      published: true,
      linkedDocuments: [
        {
          type: 'TwoDVectorPushpin',
          urn: this.urn,
          createdBy: this.accUserId.toString(),
          createdAt: new Date().toISOString(),
          createdAtVersion: 1,
          closedBy: null,
          closedAt: null,
          closedAtVersion: null,
          details: {
            viewable: {
              id: view.id,
              viewableId: view.viewableId,
              guid: view.guid,
              name: view.name,
              is3D: view.is3D,
            },
            position,
            objectId,
            externalId,
            viewerState: {
              ...viewerState,
              attributesVersion: 2,
            },
          },
        },
      ],
    };
  }
}
