import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LocalService } from '../../services/local.service';
import { RuleCheckResponse, RuleService } from '../../services/rule.service';
import { ToastService } from '../../services/toast.service';
import { BollardValidationResponse } from '../../services/viewer-measure.service';
import { ViewerService } from '../../services/viewer.service';

// Box validation interface
interface BoxValidationResponse {
  validationResults: Array<{
    Name: string;
    length_mm: number;
    width_mm: number;
    isValid: boolean;
    elementIds: string[];
  }>;
  summary: {
    totalElementChecked: number;
    failedValidations: number;
    failedWithElementIds: number;
    failedWithoutElementIds: number;
    uniqueElementIds: number;
  };
}

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
  additionalNotes?: string[];
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
  rule7Data: BollardValidationResponse | null = null;
  rule8Data: BoxValidationResponse | null = null;
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
      this.rule7Data = null;
      this.rule8Data = null;
      this.highlight = false;
      this.setupRuleInfo();
      this.viewerService.clearFailedElementsVisuals();
      this.viewerService.clearProcessedRevitIds();

      // Rule 7 is handled directly in checkRule7() method
      // Rule 8 is handled directly in checkRule8() method
    }
  }

  setupRuleInfo() {
    switch (this.ruleType) {
      case 'rule1':
        this.ruleInfo = {
          title: 'Rule 1 - Accessibility Around and Within the Building: Doors',
          description:
            'Validates the minimum clear opening of doorways to ensure accessibility. This rule checks that the clear opening is 850 mm when measured between the face of the door and the face of the doorstop with the door open at 90 degrees.',
          executionInfo:
            '1) Identify doorways along the accessible route (accessible door).\n' +
            '2) Check that the minimum distance between face of the door and face of the doorstop with the door open at 90 degrees is 850mm.\n' +
            '3) Create ACC issues for non-compliant doorways.',
          category: 'Doors & Accessibility',
          thresholds: {
            minimum: 850,
            maximum: null,
            unit: 'mm',
            requirement:
              'The minimum clear opening of doorways must be 850 mm measured between the face of the door and the face of the doorstop with the door open at 90°.',
          },
          thresholdsTable: {
            headers: ['Door Type', 'Minimum Clear Opening'],
            rows: [
              ['Sliding/Automatic Door', '850 mm'],
              ['Swing Door', '850 mm'],
              ['Folding Door', '850 mm'],
            ],
          },
        };
        break;

      case 'rule2':
        this.ruleInfo = {
          title:
            'Rule 2 - Arriving at The Building: Accessible Vehicle Parking',
          description:
            'Validates the provision of accessible parking lots for vehicles driven by persons with disabilities, in accordance with Table 2 of the Code of Accessibility, with exceptions for hospitals.',
          executionInfo:
            '1) Determine if the development is a hospital. If so, minimum accessible parking provision is not applicable (refer to clause 3.5.1.2).\n' +
            '2) Identify the total number of vehicle parking lots provided for the development.\n' +
            '3) If the number of vehicle parking lots is more than 10, check the number of accessible lots provided against Table 2.\n' +
            '4) If the number of vehicle parking lots is 10 or less, check if one of the lots is designed and constructed in accordance with the specification in the Code (not required to display the Symbol of Access).\n' +
            "5) Ensure accessible parking lots are over and above LTA's parking requirements.\n" +
            '6) Create ACC issues for non-compliant parking provisions.',
          category: 'Parking & Accessibility',
          thresholds: {
            minimum: null,
            maximum: null,
            unit: null,
            requirement:
              'Where vehicle parks are required to be provided, the number of accessible parking lots for vehicles driven by persons with disabilities shall be in accordance with Table except in hospitals.',
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
          additionalNotes: [
            "(1) The number of accessible parking lots provided must be over and above the LTA's parking requirements.",
            '(2) However, for small developments where the minimum requirement for car parking lots is 10 or less, no additional accessible parking lot is required provided one of the lots is designed and constructed in accordance with the specification in the Code but without displaying the Symbol of Access. Should the need arise; the car parking lot can be converted into an accessible lot.',
          ],
        };
        break;

      case 'rule3':
        this.ruleInfo = {
          title:
            'Rule 3 - Accessibility Around and Within the Building: Ramp - Width',
          description:
            'Validates the minimum clear width of ramps to ensure accessibility. Ramps that are part of accessible routes, corridors, and paths must comply with clause 4.2.1. Otherwise, a minimum clear width of 1200mm is required.',
          executionInfo:
            '1) Check if the ramp is part of an accessible route.\n' +
            '2) If yes, verify that the minimum clear width of the ramp complies with Clause 4.2.1.\n' +
            '3) If no, verify that the minimum clear width of the ramp is 1200mm.\n' +
            '4) Create ACC issues for non-compliant ramps.',
          category: 'Ramps & Accessibility',
          thresholds: {
            minimum: 1200,
            maximum: null,
            unit: 'mm',
            requirement:
              'Ramps that are part of accessible routes, corridors and paths shall comply with clause 4.2.1. Otherwise, the minimum clear width of a ramp shall be 1200mm.',
          },
          thresholdsTable: {
            headers: ['Ramp Type', 'Minimum Clear Width Requirement'],
            rows: [
              ['Part of Accessible Route', 'Complies with Clause 4.2.1'],
              ['Not Part of Accessible Route', '1200 mm'],
            ],
          },
        };
        break;

      case 'rule4':
        this.ruleInfo = {
          title:
            'Rule 4 - Accessibility Around and Within the Building: Lifts Designated for Wheelchair Users',
          description:
            'Validates lift lobby manoeuvring space for wheelchair users to ensure accessibility compliance. This rule checks that lifts designed for wheelchair users have adequate clear manoeuvring space in the lobby area.',
          executionInfo:
            '1) Identify accessible lifts designated for wheelchair users.\n' +
            '2) Check that clear manoeuvring space of 1200mm wide by 1500mm deep is provided at the lift door.\n' +
            '3) If private lift is along the accessible route, private lift also needs to comply with these requirements.\n' +
            '4) Create ACC issues for non-compliant lift lobby spaces.',
          category: 'Lifts & Accessibility',
          thresholds: {
            minimum: {
              clearWidth: 1200,
              transferZone: { width: 1200, depth: 1500 },
            },
            maximum: null,
            unit: 'mm',
            requirement:
              'Lift lobby space with lifts designed for wheelchair users must have a clear manoeuvring space of 1200 mm wide by 1500 mm deep.',
          },
          thresholdsTable: {
            headers: ['Lift Lobby Requirement', 'Minimum Dimension'],
            rows: [
              ['Clear Width', '1200 mm'],
              ['Clear Depth', '1500 mm'],
            ],
          },
        };
        break;

      case 'rule5':
        this.ruleInfo = {
          title:
            'Rule 5 - Accessibility Around and Within the Building: Lifts Designated for Wheelchair Users',
          description:
            'Validates the minimum internal lift car dimensions for wheelchair users to ensure accessibility compliance. This rule checks that lifts designated for wheelchair users have adequate internal dimensions for safe and comfortable use.',
          executionInfo:
            '1) Identify accessible lifts designated for wheelchair users.\n' +
            '2) Check that internal dimensions of lift car is 1200mm wide by 1400mm deep.\n' +
            '3) Create ACC issues for non-compliant lift car dimensions.',
          category: 'Lifts & Accessibility',
          thresholds: {
            minimum: {
              clearWidth: 1200,
              transferZone: { width: 1200, depth: 1400 },
            },
            maximum: null,
            unit: 'mm',
            requirement:
              'The minimum internal lift car dimension must be 1200 mm wide by 1400 mm deep.',
          },
          thresholdsTable: {
            headers: ['Lift Car Requirement', 'Minimum Dimension'],
            rows: [
              ['Internal Width', '1200 mm'],
              ['Internal Depth', '1400 mm'],
            ],
          },
        };

        break;

      case 'rule6':
        this.ruleInfo = {
          title: 'Rule 6 - Staircase Riser Height',
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

      case 'rule7':
        this.ruleInfo = {
          title: 'Rule 7 - Bollard Distance Analysis',
          description:
            'Validates the minimum clear distance between adjacent bollards to ensure proper spacing for accessibility and safety.',
          executionInfo:
            'Identifies bollard elements and measures face-to-face distances between consecutive neighbors. Validates that the minimum clear distance between bollards is 900mm.',
          category: 'Site Elements',
          thresholds: {
            minimum: 900,
            maximum: null,
            unit: 'mm',
            requirement:
              'The minimum clear distance between adjacent bollards must be 900mm for accessibility compliance',
          },
        };
        break;

      case 'rule8':
        this.ruleInfo = {
          title:
            'Rule 8 - Accessibility Around and Within the Building: Lifts Designated for Wheelchair Users',
          description:
            'Validates lift lobby manoeuvring space for wheelchair users to ensure accessibility compliance. This rule checks that lifts designed for wheelchair users have adequate clear manoeuvring space in the lobby area.',
          executionInfo:
            '1) Identify accessible lifts designated for wheelchair users.\n' +
            '2) Check that clear manoeuvring space of 1200mm wide by 1500mm deep is provided at the lift door.\n' +
            '3) If private lift is along the accessible route, private lift also needs to comply with these requirements.\n' +
            '4) Create ACC issues for non-compliant lift lobby spaces.',
          category: 'Lifts & Accessibility',
          thresholds: {
            minimum: {
              clearWidth: 1200,
              transferZone: { width: 1200, depth: 1500 },
            },
            maximum: null,
            unit: 'mm',
            requirement:
              'Lift lobby space with lifts designed for wheelchair users must have a clear manoeuvring space of 1200 mm wide by 1500 mm deep.',
          },
          thresholdsTable: {
            headers: ['Lift Lobby Requirement', 'Minimum Dimension'],
            rows: [
              ['Clear Width', '1200 mm'],
              ['Clear Depth', '1500 mm'],
            ],
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
    } else if (this.ruleType === 'rule6') {
      this.checkRule6();
    } else if (this.ruleType === 'rule7') {
      this.checkRule7();
    } else if (this.ruleType === 'rule8') {
      this.checkRule8();
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
          this.error = 'Failed to check rule 5. Please try again.';
          this.loading = false;
        },
      });
  }

  checkRule6() {
    this.ruleService
      .checkRule6(this.elementGroupId, this.accUserId, this.projectId!)
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
          this.error = 'Failed to check rule 6. Please try again.';
          this.loading = false;
        },
      });
  }

  checkRule7() {
    const viewer = this.viewerService.getViewer();
    if (!viewer) {
      this.error = 'Viewer not available';
      this.loading = false;
      return;
    }

    this.viewerService
      .measureBollardDistances(viewer, {
        select: false,
        onlyLeaves: true,
        category: 'Specialty Equipment',
        family: 'TS_Square Bollard',
        typeValue: 'Bollard',
        pairing: 'chain',
        minOverlapXY: 5,
        minOverlapZ: 5,
        lineTolMM: 3,
      })
      .then(async (result) => {
        if (result.validation) {
          this.rule7Data = result.validation;

          // Also set validationData for UI compatibility
          console.log(
            '[RuleModal] Original validation results:',
            result.validation.validationResults
          );

          const mappedResults = result.validation.validationResults.map(
            (r: any) => ({
              typeId: `${r.A_Label}-${r.B_Label}`,
              typeName: 'Bollard Pair',
              familyName: 'TS_Square Bollard',
              widthMm: r.clearDistanceBetweenBollard || 0,
              isValid: r.isValid,
              elementIds: r.elementIds,
            })
          );

          console.log('[RuleModal] Mapped validation results:', mappedResults);

          this.validationData = {
            validationResults: mappedResults,
            summary: {
              totalTypesChecked: result.validation.validationResults.length,
              failedValidations: result.validation.summary.failedValidations,
              failedWithElementIds:
                result.validation.summary.failedWithElementIds,
              failedWithoutElementIds:
                result.validation.summary.failedValidations -
                result.validation.summary.failedWithElementIds,
              totalFailedElementInstances:
                result.validation.validationResults.filter(
                  (r: any) => !r.isValid
                ).length,
              uniqueElementIds: new Set(
                result.validation.validationResults.flatMap(
                  (r: any) => r.elementIds
                )
              ).size,
              duplicateElementIds: 0,
              perfectMatchesFound: result.validation.validationResults.filter(
                (r: any) => r.isValid
              ).length,
              totalInstancesChecked: result.validation.validationResults.length,
            },
            failureBreakdown: {},
          };

          console.log(
            '[RuleModal] Final validationData set:',
            JSON.stringify(this.validationData)
          );
          console.log(
            '[RuleModal] Rule 7 validation completed:',
            JSON.stringify(result.validation)
          );
        }

        // Set ruleData to trigger UI display
        this.ruleData = {
          rule: 'rule7',
          summary: {
            totalPassed: this.getPassedCount(),
            totalFailed: this.getFailedCount(),
            totalElements: this.getTotalCount(),
          },
          issuesCreated: 0,
        };

        console.log('[RuleModal] ruleData set for Rule 7:', this.ruleData);

        // Single comprehensive log for Rule 7 data
        console.log('[RuleModal] Rule 7 Final State:', {
          passedCount: this.getPassedCount(),
          failedCount: this.getFailedCount(),
          totalCount: this.getTotalCount(),
          validationDataExists: !!this.validationData,
          ruleDataExists: !!this.ruleData,
        });

        this.loading = false;
        await this.getFailedElements();
      })
      .catch((error) => {
        console.error('[RuleModal] Error during Rule 7 analysis:', error);
        this.error = 'Failed to analyze bollard distances. Please try again.';
        this.loading = false;
      });
  }

  checkRule8() {
    const viewer = this.viewerService.getViewer();
    if (!viewer) {
      this.error = 'Viewer not available';
      this.loading = false;
      return;
    }

    this.viewerService
      .validateMassBoxDimensions()
      .then(async (result) => {
        if (result) {
          this.rule8Data = result;

          // Also set validationData for UI compatibility
          console.log(
            '[RuleModal] Original Box validation results:',
            result.validationResults
          );

          const mappedResults = result.validationResults.map((r: any) => ({
            typeId: r.Name,
            typeName: 'Box Element',
            familyName: 'Box',
            widthMm: r.width_mm,
            isValid: r.isValid,
            elementIds: r.elementIds,
            // Additional properties for Box elements
            lengthMm: r.length_mm,
          }));

          console.log(
            '[RuleModal] Mapped Box validation results:',
            mappedResults
          );

          this.validationData = {
            validationResults: mappedResults,
            summary: {
              totalTypesChecked: result.validationResults.length,
              failedValidations: result.summary.failedValidations,
              failedWithElementIds: result.summary.failedWithElementIds,
              failedWithoutElementIds: result.summary.failedWithoutElementIds,
              totalFailedElementInstances: result.summary.failedValidations,
              uniqueElementIds: result.summary.uniqueElementIds,
              duplicateElementIds: 0,
              perfectMatchesFound:
                result.summary.totalElementChecked -
                result.summary.failedValidations,
              totalInstancesChecked: result.summary.totalElementChecked,
            },
            failureBreakdown: {},
          };

          console.log(
            '[RuleModal] Final Box validationData set:',
            JSON.stringify(this.validationData)
          );
          console.log(
            '[RuleModal] Rule 8 validation completed:',
            JSON.stringify(result)
          );
        }

        // Set ruleData to trigger UI display
        this.ruleData = {
          rule: 'rule8',
          summary: {
            totalPassed: this.getPassedCount(),
            totalFailed: this.getFailedCount(),
            totalElements: this.getTotalCount(),
          },
          issuesCreated: 0,
        };

        console.log('[RuleModal] ruleData set for Rule 8:', this.ruleData);

        // Single comprehensive log for Rule 8 data
        console.log('[RuleModal] Rule 8 Final State:', {
          passedCount: this.getPassedCount(),
          failedCount: this.getFailedCount(),
          totalCount: this.getTotalCount(),
          validationDataExists: !!this.validationData,
          ruleDataExists: !!this.ruleData,
        });

        this.loading = false;
        await this.getFailedElements();
      })
      .catch((error) => {
        console.error('[RuleModal] Error during Rule 8 analysis:', error);
        this.error = 'Failed to validate Box dimensions. Please try again.';
        this.loading = false;
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
      (this.ruleType === 'rule7' || this.ruleType === 'rule8')
    ) {
      return this.validationData.validationResults.filter(
        (result) => result.isValid
      ).length;
    }

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
      (this.ruleType === 'rule7' || this.ruleType === 'rule8')
    ) {
      return this.validationData.validationResults.filter(
        (result) => !result.isValid
      ).length;
    }

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
      (this.ruleType === 'rule7' || this.ruleType === 'rule8')
    ) {
      return this.validationData.validationResults.length;
    }

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
    if (
      this.validationData &&
      (this.ruleType === 'rule7' || this.ruleType === 'rule8')
    ) {
      // For Rule 7, return validation results formatted for display
      return this.validationData.validationResults.map((result) => ({
        typeId: result.typeId,
        typeName: result.typeName,
        familyName: result.familyName,
        passed: result.isValid,
        widthMm: result.widthMm,
        elementIds: result.elementIds,
        message: `Clear distance: ${
          result.widthMm ? result.widthMm.toFixed(1) + 'mm' : 'N/A'
        }`,
      }));
    } else if (this.rule2Data && this.ruleType === 'rule2') {
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

  getRule7Data(): BollardValidationResponse | null {
    return this.rule7Data || null;
  }

  getRule8Data(): BoxValidationResponse | null {
    return this.rule8Data || null;
  }

  isRule3(): boolean {
    return this.ruleType === 'rule3';
  }

  isRule2(): boolean {
    return this.ruleType === 'rule2';
  }

  isRule7(): boolean {
    return this.ruleType === 'rule7' || this.ruleType === 'rule8';
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
    // Rule7 uses validation data
    if (this.ruleType === 'rule7' || this.ruleType === 'rule8') {
      const result = this.validationData !== null;
      // console.log(
      //   '[RuleModal] isUsingValidationData() for Rule 7:',
      //   result,
      //   'validationData:',
      //   this.validationData
      // );
      return result;
    }
    return this.validationData !== null;
  }

  hasEmptyResults(): boolean {
    if (
      this.validationData &&
      (this.ruleType === 'rule7' || this.ruleType === 'rule8')
    ) {
      return this.validationData.validationResults.length === 0;
    }

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
    console.log(
      '[RuleModal] getFailedElements() called for ruleType:',
      this.ruleType
    );

    let failedElements: Array<{ revitElementId: string }> = [];

    if (
      this.validationData &&
      (this.ruleType === 'rule7' || this.ruleType === 'rule8')
    ) {
      // Handle Rule 7 failed elements using validationData
      console.log(
        '[RuleModal] getFailedElements - validationData:',
        this.validationData
      );
      console.log(
        '[RuleModal] getFailedElements - validationResults:',
        this.validationData.validationResults
      );

      const failedResults = this.validationData.validationResults.filter(
        (result) => !result.isValid && result.elementIds.length > 0
      );
      console.log(
        '[RuleModal] getFailedElements - failedResults:',
        failedResults
      );

      failedElements = failedResults.flatMap((result) =>
        result.elementIds.map((elementId) => ({
          revitElementId: elementId,
        }))
      );
      console.log(
        '[RuleModal] getFailedElements - failedElements:',
        failedElements
      );

      console.log(
        '[RuleModal] getFailedElements - Processing ACC Issues for Rule 7:',
        {
          totalFailedElements: failedElements.length,
          elementIds: failedElements.map((e) => e.revitElementId),
          willCreateIssues: failedElements.length > 0,
        }
      );

      this.highlight = failedElements.length > 0;
      console.log(
        '[RuleModal] Rule 7 highlight set to:',
        this.highlight,
        'for',
        failedElements.length,
        'failed elements'
      );

      // Process ACC issues for Rule 7
      if (failedElements.length > 0) {
        console.log('[RuleModal] About to start ACC issue processing:', {
          failedElementsLength: failedElements.length,
          highlight: this.highlight,
          ruleType: this.ruleType,
        });

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

        const processBatch = async (
          batch: Array<{ revitElementId: string }>
        ) => {
          console.log(
            '[RuleModal] Processing batch for ACC issues:',
            batch.map((e) => e.revitElementId)
          );

          const batchPromises = batch.map(async (element) => {
            const revitId = element.revitElementId;

            if (!revitId) {
              showToastIfComplete();
              return;
            }

            try {
              console.log(
                `[RuleModal] Processing element ${revitId} for Rule 7 ACC issue creation`
              );

              const processResult = await this.viewerService.processModel(
                revitId
              );
              console.log(
                `[RuleModal] processModel result for ${revitId}:`,
                processResult
              );

              if (processResult) {
                const result = this.generateIssuePayloadFromProcessResult(
                  processResult,
                  this.getResults()
                );
                console.log(
                  `[RuleModal] Generated issue payload for ${revitId}:`,
                  result
                );

                this.ruleService
                  .createIssue(this.projectId!, this.accUserId, result)
                  .subscribe({
                    next: (response) => {
                      console.log(
                        `[RuleModal] ACC issue created successfully for ${revitId}:`,
                        response
                      );
                      successfulIssues++;
                      showToastIfComplete();
                    },
                    error: (error) => {
                      console.error(
                        `[RuleModal] Failed to create ACC issue for ${revitId}:`,
                        error
                      );
                      showToastIfComplete();
                    },
                  });
              } else {
                console.warn(
                  `[RuleModal] No process result for ${revitId}, skipping ACC issue creation`
                );
                showToastIfComplete();
              }
            } catch (error) {
              console.error(`[RuleModal] Error processing ${revitId}:`, error);
              showToastIfComplete();
            }
          });

          await Promise.all(batchPromises);
        };

        const processAllBatches = async () => {
          try {
            console.log(
              `[RuleModal] Starting ACC issue creation for ${failedElements.length} failed elements in batches of ${BATCH_SIZE}`
            );

            if (failedElements.length === 0) {
              console.log(
                '[RuleModal] No failed elements to process, skipping ACC issue creation'
              );
              return;
            }

            for (let i = 0; i < failedElements.length; i += BATCH_SIZE) {
              const batch = failedElements.slice(i, i + BATCH_SIZE);
              console.log(
                `[RuleModal] Processing batch ${
                  Math.floor(i / BATCH_SIZE) + 1
                }/${Math.ceil(failedElements.length / BATCH_SIZE)}`
              );
              await processBatch(batch);

              if (i + BATCH_SIZE < failedElements.length) {
                await new Promise((resolve) =>
                  setTimeout(resolve, BATCH_DELAY)
                );
              }
            }

            console.log('[RuleModal] All batches processed successfully');
          } catch (error) {
            console.error('[RuleModal] Error in processAllBatches:', error);
          }
        };

        console.log(
          '[RuleModal] About to start processAllBatches() for Rule 7'
        );
        processAllBatches().catch((error) => {
          console.error('[RuleModal] Error in processAllBatches:', error);
        });
        console.log(
          '[RuleModal] processAllBatches() started (async) for Rule 7'
        );
      }

      return failedElements;
    } else if (
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

    console.log('[RuleModal] About to start ACC issue processing:', {
      failedElementsLength: failedElements.length,
      highlight: this.highlight,
      ruleType: this.ruleType,
    });

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
      console.log(
        '[RuleModal] Processing batch for ACC issues:',
        batch.map((e) => e.revitElementId)
      );

      const batchPromises = batch.map(async (element) => {
        const revitId = element.revitElementId;

        if (!revitId) {
          showToastIfComplete();
          return;
        }

        try {
          console.log(
            `[RuleModal] Processing element ${revitId} for Rule 7 ACC issue creation`
          );

          const processResult = await this.viewerService.processModel(revitId);
          console.log(
            `[RuleModal] processModel result for ${revitId}:`,
            processResult
          );

          if (processResult) {
            const result = this.generateIssuePayloadFromProcessResult(
              processResult,
              this.getResults()
            );
            console.log(
              `[RuleModal] Generated issue payload for ${revitId}:`,
              result
            );

            this.ruleService
              .createIssue(this.projectId!, this.accUserId, result)
              .subscribe({
                next: (response) => {
                  console.log(
                    `[RuleModal] ACC issue created successfully for ${revitId}:`,
                    response
                  );
                  successfulIssues++;
                  showToastIfComplete();
                },
                error: (error) => {
                  console.error(
                    `[RuleModal] Failed to create ACC issue for ${revitId}:`,
                    error
                  );
                  showToastIfComplete();
                },
              });
          } else {
            console.warn(
              `[RuleModal] No process result for ${revitId}, skipping ACC issue creation`
            );
            showToastIfComplete();
          }
        } catch (error) {
          console.error(`[RuleModal] Error processing ${revitId}:`, error);
          showToastIfComplete();
        }
      });

      await Promise.all(batchPromises);
    };

    const processAllBatches = async () => {
      try {
        console.log(
          `[RuleModal] Starting ACC issue creation for ${failedElements.length} failed elements in batches of ${BATCH_SIZE}`
        );

        if (failedElements.length === 0) {
          console.log(
            '[RuleModal] No failed elements to process, skipping ACC issue creation'
          );
          return;
        }

        for (let i = 0; i < failedElements.length; i += BATCH_SIZE) {
          const batch = failedElements.slice(i, i + BATCH_SIZE);
          console.log(
            `[RuleModal] Processing batch ${
              Math.floor(i / BATCH_SIZE) + 1
            }/${Math.ceil(failedElements.length / BATCH_SIZE)}`
          );
          await processBatch(batch);

          if (i + BATCH_SIZE < failedElements.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
          }
        }

        console.log('[RuleModal] All batches processed successfully');
      } catch (error) {
        console.error('[RuleModal] Error in processAllBatches:', error);
      }
    };

    console.log('[RuleModal] About to start processAllBatches() for Rule 7');
    processAllBatches().catch((error) => {
      console.error('[RuleModal] Error in processAllBatches:', error);
    });
    console.log('[RuleModal] processAllBatches() started (async) for Rule 7');

    console.log(
      `[RuleModal] getFailedElements() returning ${failedElements.length} elements for Rule 7 ACC issue creation`
    );
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
      } else if (this.ruleType === 'rule6') {
        title = `Rule 6 Check Failed - ${view.name}`;
        description = `${
          results.find(
            (result: { revitElementId: any }) =>
              result.revitElementId === objectId
          )?.message || 'Rule 6 check failed'
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
