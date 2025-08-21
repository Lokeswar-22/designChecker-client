import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuleService, RuleCheckResponse } from '../../services/rule.service';
import { LocalService } from '../../services/local.service';
import { ViewerService } from '../../services/viewer.service';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { firstValueFrom } from 'rxjs';


interface RuleInfo {
  title: string;
  description: string;
  executionInfo: string;
  category: string;
  thresholds: {
    minimum: number | string | { clearWidth: number; transferZone: { width: number; depth: number; } } | null;
    maximum: number | string | null;
    unit: string | null;
    requirement: string | null;
  };
  thresholdsTable?: {
    headers: string[];
    rows: Array<Array<string | number>>;
  };
}

// New interfaces for the validation results data structure
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
  // New properties for enhanced summary data
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

// New interfaces for Rule3 parking data
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
  styleUrl: './rule-modal.scss'
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
  validationData: ValidationResponse | null = null; // New property for validation data
  rule3Data: Rule3Response | null = null; // New property for Rule3 parking data
  error: string = '';
  urn: string = '';
  
  // New acknowledgement state
  showAcknowledgement = true;
  
  // Highlight state for CDPD button
  highlight = false;
  
  // Rule information for acknowledgement popup
  ruleInfo: RuleInfo = {
    title: '',
    description: '',
    executionInfo: '',
    category: '',
    thresholds: {
      minimum: null,
      maximum: null,
      unit: null,
      requirement: null
    }
  };

  constructor(private ruleService: RuleService,
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
          console.log('Project by ID API response:', response);
          this.projectId = response.projectId.split('.')[1];
          console.log("PROJECT ID",this.projectId)
          
          // Don't auto-check rule, wait for user acknowledgement
        },
        error: (error) => {
          console.error('Error calling project by ID API:', error);
        }
      });
    }
    
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(decodeURIComponent(queryParams['alternativeIdentifiers']));
          console.log('ElementGroupDetailsComponent: alternativeIdentifiers from query params:', alternativeIdentifiers);
          this.urn = alternativeIdentifiers.fileUrn;
        } catch (error) {
          console.error('ElementGroupDetailsComponent: Error parsing alternativeIdentifiers:', error);
        }
      } else {
        console.log('ElementGroupDetailsComponent: No alternativeIdentifiers in query params');
      }
    });
  }

  ngOnChanges() {
    console.log('ngOnChanges called - isVisible:', this.isVisible);
    
    // Reset to acknowledgement state when modal becomes visible
    if (this.isVisible) {
      console.log('Modal is visible, resetting state');
      this.showAcknowledgement = true;
      this.loading = false;
      this.error = '';
      this.ruleData = null;
      this.validationData = null; // Reset validation data
      this.rule3Data = null; // Reset Rule3 data
      this.highlight = false; // Reset highlight state
      this.setupRuleInfo(); // Update rule info when ruleType changes
      
      // Clear any existing failed elements visuals when modal opens
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
            '3) If the instance has no width, look up the instance’s Family/Type and read the Type "Width".\n' +
            '4) If a width is found (from instance or type), check width ≥ 850 mm → PASS, else FAIL.\n' +
            '5) If no width is found in either place, mark as FAIL.\n' +
            '6) Create ACC issues for all failed elements.',
          category: 'Doors',
          thresholds: {
            minimum: 850,
            maximum: null,
            unit: 'mm',
            requirement:
              'Door width (instance "Width" or fallback Type "Width") must be ≥ 850 mm. If "Width" is missing on both instance and type, the element FAILS.'
          },
        };
        break;

        case 'rule2':
          this.ruleInfo = {
            title: 'Rule 2 - Ramp Slope Validation',
            description: 'Validates ramp slopes based on vertical rise calculations to ensure compliance with accessibility gradient requirements.',
            executionInfo: 'Fetches ramp type and instance data. Calculates vertical rise using formula: vertical rise = (1/slope) × InclineLength. Validates slope ratios against vertical rise ranges and flags non-compliant ramps.',
            category: 'Ramps',
            thresholds: {
              minimum: null,
              maximum: 'Variable based on vertical rise',
              unit: 'slope ratio (1:x)',
              requirement: '0-15mm: 1:2 max, 15-50mm: 1:5 max, 50-200mm: 1:10 max, >200mm: 1:12 max'
            },
            thresholdsTable: {
              headers: ['Vertical Rise (mm)', 'Maximum Slope Ratio (1:x)'],
              rows: [
                [0, '1:2'],
                [15, '1:5'],
                [50, '1:10'],
                [200, '1:12']
              ]
            }
          };
          break;
        
        case 'rule3':
          this.ruleInfo = {
            title: 'Rule 3 - Parking Accessibility Compliance',
            description: 'Validates that sufficient handicapped parking spaces are provided based on the total number of normal parking spaces.',
            executionInfo: 'Fetches parking data by level. Counts total, normal, and handicapped parking spaces (identifies HCP/Handicapped in names). Validates compliance with accessibility requirements and calculates shortfall if needed.',
            category: 'Parking',
            thresholds: {
              minimum: 'Variable based on normal spaces',
              maximum: null,
              unit: 'handicapped spaces required',
              requirement: '≤50: 1 required, 51-100: 2 required, 101-300: 3 required, 301-500: 4 required, >500: 4 + (additional÷200)'
            },
            thresholdsTable: {
              headers: ['Number of vehicle parking lots', 'Number of accessible lots'],
              rows: [
                [50, 1],
                [100, 2],
                [300, 3],
                [500, 4]
              ]
            }
          };
          break;
        
      case 'rule4':
        this.ruleInfo = {
          title: 'Rule 4 - Ramp width Check',
          description: 'Ensures staircases with 5 or more risers have handrails positioned within the accessible height range.',
          executionInfo: 'Fetches stair elements (category = Stairs). Uses Actual Number of Risers, Riser Height, and Tread Depth to confirm rule applicability. Attempts to validate Handrail Height (mm). If missing, flags Fail with context.',
          category: 'Stairs',
          thresholds: {
            minimum: 800,
            maximum: 1000,
            unit: 'mm',
            requirement: 'Handrail height must be between 800 mm and 1000 mm, measured vertically from the pitch line'
          }
        };
        break;
      case 'rule5':
        this.ruleInfo = {
          title: 'Rule 5 - Staircase Riser Height',
          description: 'Validates that Stairs have riser height.',
          executionInfo: 'Fetches wall elements (category = Walls) as proxy due to missing washroom elements. Uses Width property with heuristic scaling to infer clear dimension. Checks compliance with minimum width requirement and flags missing transfer zone data.',
          category: 'Sanitary Provision',
          thresholds: {
            minimum: { clearWidth: 1750, transferZone: { width: 900, depth: 1500 } },
            maximum: null,
            unit: 'mm',
            requirement: 'Clear width ≥ 1750 mm and adjacent transfer space ≥ 900 mm x 1500 mm'
          }
        };
        break;
      default:
        this.ruleInfo = {
          title: 'Rule Check',
          description: 'This rule performs compliance checking on building elements.',
          executionInfo: 'The system will analyze elements and create ACC issues for non-compliant items.',
          category: 'General',
          thresholds: {
            minimum: null,
            maximum: null,
            unit: null,
            requirement: 'Generic compliance check'
          }
        };
    }
  }
  

  onContinue() {
    console.log('Continue button clicked!');
    this.showAcknowledgement = false;
    this.checkRule();
  }

  onCancel() {
    console.log('Cancel button clicked!');
    this.onClose();
  }

  checkRule() {
    this.loading = true;
    this.error = '';
    this.ruleData = null;
    this.highlight = false; // Reset highlight state

    // Clear failed elements visuals and processed Revit IDs before starting new rule execution
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
    this.ruleService.checkRule1(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 1 check response:', response);
        this.ruleData = response;
        
        // Handle the new validation data structure
        if (response && response.validationResults) {
          try {
            console.log('Processing validation data structure:', response);
            this.validationData = {
              validationResults: response.validationResults,
              summary: response.summary as any, // Type assertion for the summary
              failureBreakdown: response.failureBreakdown
            };
            
            console.log('Set validationData:', this.validationData);
            console.log('Validation results count:', this.validationData.validationResults?.length);
            console.log('hasEmptyResults result:', this.hasEmptyResults());
            
            // Validate the data structure
            if (!this.validationData.validationResults || !this.validationData.summary) {
              console.warn('Validation data structure is incomplete, falling back to legacy format');
              this.validationData = null;
            }
          } catch (error) {
            console.error('Error parsing validation data:', error);
            this.validationData = null;
          }
        } else {
          console.log('No validationResults found in response, using legacy format');
        }
        
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 1: No elements found to validate');
        }
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        
        console.log('Rule check completed. Final state:');
        console.log('- validationData:', this.validationData);
        console.log('- hasEmptyResults():', this.hasEmptyResults());
        console.log('- getTotalCount():', this.getTotalCount());
        console.log('- getPassedCount():', this.getPassedCount());
        console.log('- getFailedCount():', this.getFailedCount());
    },
    error: (error: any) => {
      console.error('Error checking rule 1:', error);
      this.error = 'Failed to check rule 1. Please try again.';
      this.loading = false;
    }
  });
  }

  checkRule2() {
    this.ruleService.checkRule2(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 2 check response:', response);
        this.ruleData = response;
        
        // Handle the new validation data structure
        if (response && response.validationResults) {
          try {
            console.log('Processing validation data structure:', response);
            this.validationData = {
              validationResults: response.validationResults,
              summary: response.summary as any, // Type assertion for the summary
              failureBreakdown: response.failureBreakdown
            };
            
            console.log('Set validationData:', this.validationData);
            console.log('Validation results count:', this.validationData.validationResults?.length);
            console.log('hasEmptyResults result:', this.hasEmptyResults());
            
            // Validate the data structure
            if (!this.validationData.validationResults || !this.validationData.summary) {
              console.warn('Validation data structure is incomplete, falling back to legacy format');
              this.validationData = null;
            }
          } catch (error) {
            console.error('Error parsing validation data:', error);
            this.validationData = null;
          }
        } else {
          console.log('No validationResults found in response, using legacy format');
        }
        
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 1: No elements found to validate');
        }
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        
        console.log('Rule check completed. Final state:');
        console.log('- validationData:', this.validationData);
        console.log('- hasEmptyResults():', this.hasEmptyResults());
        console.log('- getTotalCount():', this.getTotalCount());
        console.log('- getPassedCount():', this.getPassedCount());
        console.log('- getFailedCount():', this.getFailedCount());
    },
    error: (error: any) => {
      console.error('Error checking rule 1:', error);
      this.error = 'Failed to check rule 1. Please try again.';
      this.loading = false;
    }
  });  }

  checkRule3() {
    const LevelName = 'BASEMENT';
    this.ruleService.checkRule3(this.elementGroupId, this.accUserId, this.projectId!, LevelName!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 3 check response:', response);
        this.ruleData = response;
        
        // Handle Rule3 parking data structure
        if (response && response.validationResults && (response as any).parkingAnalysis) {
          try {
            console.log('Processing Rule3 parking data structure:', response);
            this.rule3Data = response as unknown as Rule3Response;
            
            console.log('Set rule3Data:', this.rule3Data);
            console.log('Parking analysis:', this.rule3Data.parkingAnalysis);
            console.log('Normal parking breakdown:', this.rule3Data.normalParkingBreakdown);
            console.log('Handicapped parking breakdown:', this.rule3Data.handicappedParkingBreakdown);
            
            // Also set validationData for compatibility
            this.validationData = {
              validationResults: response.validationResults,
              summary: response.summary as any,
              failureBreakdown: response.failureBreakdown
            };
          } catch (error) {
            console.error('Error parsing Rule3 parking data:', error);
            this.rule3Data = null;
            this.validationData = null;
          }
        } else if (response && response.validationResults) {
          // Handle standard validation data structure
          try {
            console.log('Processing standard validation data structure:', response);
            this.validationData = {
              validationResults: response.validationResults,
              summary: response.summary as any,
              failureBreakdown: response.failureBreakdown
            };
          } catch (error) {
            console.error('Error parsing validation data:', error);
            this.validationData = null;
          }
        } else {
          console.log('No validationResults found in response, using legacy format');
        }
        
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 3: No elements found to validate');
        }
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        
        console.log('Rule 3 check completed. Final state:');
        console.log('- rule3Data:', this.rule3Data);
        console.log('- validationData:', this.validationData);
        console.log('- hasEmptyResults():', this.hasEmptyResults());
        console.log('- getTotalCount():', this.getTotalCount());
        console.log('- getPassedCount():', this.getPassedCount());
        console.log('- getFailedCount():', this.getFailedCount());
      },
      error: (error: any) => {
        console.error('Error checking rule 3:', error);
        this.error = 'Failed to check rule 3. Please try again.';
        this.loading = false;
      }
    });
  }

  checkRule4() {
    this.ruleService.checkRule4(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 2 check response:', response);
        this.ruleData = response;
        
        // Handle the new validation data structure
        if (response && response.validationResults) {
          try {
            console.log('Processing validation data structure:', response);
            this.validationData = {
              validationResults: response.validationResults,
              summary: response.summary as any, // Type assertion for the summary
              failureBreakdown: response.failureBreakdown
            };
            
            console.log('Set validationData:', this.validationData);
            console.log('Validation results count:', this.validationData.validationResults?.length);
            console.log('hasEmptyResults result:', this.hasEmptyResults());
            
            // Validate the data structure
            if (!this.validationData.validationResults || !this.validationData.summary) {
              console.warn('Validation data structure is incomplete, falling back to legacy format');
              this.validationData = null;
            }
          } catch (error) {
            console.error('Error parsing validation data:', error);
            this.validationData = null;
          }
        } else {
          console.log('No validationResults found in response, using legacy format');
        }
        
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 1: No elements found to validate');
        }
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        
        console.log('Rule check completed. Final state:');
        console.log('- validationData:', this.validationData);
        console.log('- hasEmptyResults():', this.hasEmptyResults());
        console.log('- getTotalCount():', this.getTotalCount());
        console.log('- getPassedCount():', this.getPassedCount());
        console.log('- getFailedCount():', this.getFailedCount());
    },
    error: (error: any) => {
      console.error('Error checking rule 1:', error);
      this.error = 'Failed to check rule 1. Please try again.';
      this.loading = false;
    }
  });
  }

  checkRule5() {
    this.ruleService.checkRule5(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 2 check response:', response);
        this.ruleData = response;
        
        // Handle the new validation data structure
        if (response && response.validationResults) {
          try {
            console.log('Processing validation data structure:', response);
            this.validationData = {
              validationResults: response.validationResults,
              summary: response.summary as any, // Type assertion for the summary
              failureBreakdown: response.failureBreakdown
            };
            
            console.log('Set validationData:', this.validationData);
            console.log('Validation results count:', this.validationData.validationResults?.length);
            console.log('hasEmptyResults result:', this.hasEmptyResults());
            
            // Validate the data structure
            if (!this.validationData.validationResults || !this.validationData.summary) {
              console.warn('Validation data structure is incomplete, falling back to legacy format');
              this.validationData = null;
            }
          } catch (error) {
            console.error('Error parsing validation data:', error);
            this.validationData = null;
          }
        } else {
          console.log('No validationResults found in response, using legacy format');
        }
        
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 1: No elements found to validate');
        }
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        
        console.log('Rule check completed. Final state:');
        console.log('- validationData:', this.validationData);
        console.log('- hasEmptyResults():', this.hasEmptyResults());
        console.log('- getTotalCount():', this.getTotalCount());
        console.log('- getPassedCount():', this.getPassedCount());
        console.log('- getFailedCount():', this.getFailedCount());
    },
    error: (error: any) => {
      console.error('Error checking rule 1:', error);
      this.error = 'Failed to check rule 1. Please try again.';
      this.loading = false;
    }
  });
  }

  

  onClose() {
    // Clear failed elements visuals and processed Revit IDs when modal is closed
    this.viewerService.clearFailedElementsVisuals();
    this.viewerService.clearProcessedRevitIds();
    this.highlight = false; // Reset highlight state
    this.close.emit();
  }

  async onCdpdClick() {
    console.log('returned to viewer');
    this.viewerService.highlightFailedElements();
    this.onClose();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getPassedCount(): number {
    console.log('getPassedCount called');
    console.log('validationData exists:', !!this.validationData);
    console.log('rule3Data exists:', !!this.rule3Data);
    
    // Prioritize summary data from JSON response
    if (this.validationData && this.validationData.summary && 
        this.validationData.summary.totalInstancesChecked !== undefined && 
        this.validationData.summary.totalFailedElementInstances !== undefined) {
      const count = this.validationData.summary.totalInstancesChecked - this.validationData.summary.totalFailedElementInstances;
      console.log('Summary calculated passed count:', count);
      return count;
    }
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      // For Rule3, passed count is the total parking spaces since all are valid
      const count = this.rule3Data.parkingAnalysis?.totalParkingSpaces || 0;
      console.log('Rule3 parking passed count:', count);
      return count;
    } else if (this.validationData) {
      const count = this.validationData.summary.totalTypesChecked - this.validationData.summary.failedValidations;
      console.log('Validation data passed count:', count);
      return count;
    } else if (this.ruleType === 'rule1') {
      const count = this.ruleData?.result?.summary?.totalPassed || 0;
      console.log('Legacy rule1 passed count:', count);
      return count;
    } else {
      const count = this.ruleData?.summary?.totalPassed || 0;
      console.log('Legacy other rule passed count:', count);
      return count;
    }
  }

  getFailedCount(): number {
    console.log('getFailedCount called');
    console.log('validationData exists:', !!this.validationData);
    console.log('rule3Data exists:', !!this.rule3Data);
    
    // Prioritize summary data from JSON response
    if (this.validationData && this.validationData.summary && this.validationData.summary.totalFailedElementInstances !== undefined) {
      const count = this.validationData.summary.totalFailedElementInstances;
      console.log('Summary totalFailedElementInstances count:', count);
      return count;
    }
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      // For Rule3, failed count is 0 since all parking spaces are valid
      const count = 0;
      console.log('Rule3 parking failed count:', count);
      return count;
    } else if (this.validationData) {
      const count = this.validationData.summary.failedValidations;
      console.log('Validation data failed count:', count);
      return count;
    } else if (this.ruleType === 'rule1') {
      const count = this.ruleData?.result?.summary?.totalFailed || 0;
      console.log('Legacy rule1 failed count:', count);
      return count;
    } else {
      const count = this.ruleData?.summary?.totalFailed || 0;
      console.log('Legacy other rule failed count:', count);
      return count;
    }
  }

  getTotalCount(): number {
    console.log('getTotalCount called');
    console.log('validationData exists:', !!this.validationData);
    console.log('rule3Data exists:', !!this.rule3Data);
    
    // Prioritize summary data from JSON response
    if (this.validationData && this.validationData.summary && this.validationData.summary.totalInstancesChecked) {
      const count = this.validationData.summary.totalInstancesChecked;
      console.log('Summary totalInstancesChecked count:', count);
      return count;
    }
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      const count = this.rule3Data.parkingAnalysis?.totalParkingSpaces || 0;
      console.log('Rule3 parking total count:', count);
      return count;
    } else if (this.validationData) {
      const count = this.validationData.summary?.totalTypesChecked || 0;
      console.log('Validation data total count:', count);
      return count;
    } else if (this.ruleType === 'rule1') {
      const count = this.ruleData?.result?.summary?.totalElementsChecked || 0;
      console.log('Legacy rule1 total count:', count);
      return count;
    } else {
      const count = this.ruleData?.summary?.totalElementsChecked || 0;
      console.log('Legacy other rule total count:', count);
      return count;
    }
  }

  getPassPercentage(): number {
    // For Rule 3, use the old calculation method
    if (this.ruleType === 'rule3') {
      const total = this.getTotalCount();
      if (total === 0) return 0;
      return Math.round((this.getPassedCount() / total) * 100);
    }
    
    // For other rules, use summary data from JSON response for more accurate calculation
    if (this.validationData && this.validationData.summary) {
      const totalInstancesChecked = this.validationData.summary.totalInstancesChecked || 0;
      const totalFailedElementInstances = this.validationData.summary.totalFailedElementInstances || 0;
      
      if (totalInstancesChecked === 0) return 0;
      
      const passedInstances = totalInstancesChecked - totalFailedElementInstances;
      return Math.round((passedInstances / totalInstancesChecked) * 100);
    }
    
    // Fallback to existing calculation method
    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getPassedCount() / total) * 100);
  }

  // New method for Rule 3 compliance percentage from summary
  getCompliancePercentage(): number {
    if (this.rule3Data && this.ruleType === 'rule3' && this.rule3Data.summary) {
      return this.rule3Data.summary.compliancePercent || 0;
    }
    return 0;
  }

  // New method for Rule 3 handicapped percentage from summary
  getHandicappedPercentage(): number {
    if (this.rule3Data && this.ruleType === 'rule3' && this.rule3Data.summary) {
      return this.rule3Data.summary.handicappedPercentOfTotal || 0;
    }
    return 0;
  }

  // Helper methods for Rule 3 parking table display
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
    if (this.rule3Data && this.ruleType === 'rule3') {
      // For Rule3, return 0 since all parking spaces are valid (no issues to create)
      return 0;
    }
    return this.ruleData?.issuesCreated || 0;
  }

  getResults(): any[] {
    console.log('getResults called');
    console.log('validationData exists:', !!this.validationData);
    console.log('rule3Data exists:', !!this.rule3Data);
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      // For Rule3, return parking breakdown data
      const results: any[] = [];
      
      // Add normal parking results
      if (this.rule3Data.normalParkingBreakdown) {
        Object.entries(this.rule3Data.normalParkingBreakdown).forEach(([type, parking]) => {
          results.push({
            type: 'Normal Parking',
            parkingType: type,
            count: parking.count,
            elementIds: parking.elementIds,
            passed: true
          });
        });
      }
      
      // Add handicapped parking results
      if (this.rule3Data.handicappedParkingBreakdown) {
        Object.entries(this.rule3Data.handicappedParkingBreakdown).forEach(([type, parking]) => {
          results.push({
            type: 'Handicapped Parking',
            parkingType: type,
            count: parking.count,
            elementIds: parking.elementIds,
            passed: true
          });
        });
      }
      
      console.log('Returning Rule3 parking results:', results);
      return results;
    } else if (this.validationData) {
      console.log('Returning validation results:', this.validationData.validationResults);
      return this.validationData.validationResults || [];
    } else if (this.ruleType === 'rule1') {
      console.log('Returning legacy rule1 results:', this.ruleData?.result?.results);
      return this.ruleData?.result?.results || [];
    } else {
      console.log('Returning legacy other rule results:', this.ruleData?.results);
      return this.ruleData?.results || [];
    }
  }

  getValidationResults(): ValidationResult[] {
    console.log('getValidationResults called');
    console.log('validationData:', this.validationData);
    const results = this.validationData?.validationResults || [];
    console.log('Returning validation results:', results);
    return results;
  }

  getSummary(): ValidationSummary | null {
    console.log('getSummary called');
    console.log('validationData:', this.validationData);
    const summary = this.validationData?.summary || null;
    console.log('Returning summary:', summary);
    return summary;
  }

  getFailureBreakdown(): FailureBreakdown | null {
    console.log('getFailureBreakdown called');
    console.log('validationData:', this.validationData);
    const breakdown = this.validationData?.failureBreakdown || null;
    console.log('Returning failure breakdown:', breakdown);
    return breakdown;
  }

  // Rule3-specific methods for parking data
  getParkingAnalysis(): ParkingAnalysis | null {
    return this.rule3Data?.parkingAnalysis || null;
  }

  getNormalParkingBreakdown(): ParkingBreakdown | null {
    return this.rule3Data?.normalParkingBreakdown || null;
  }

  getHandicappedParkingBreakdown(): ParkingBreakdown | null {
    return this.rule3Data?.handicappedParkingBreakdown || null;
  }

  isRule3(): boolean {
    return this.ruleType === 'rule3';
  }

  hasParkingData(): boolean {
    return this.rule3Data !== null && this.rule3Data.parkingAnalysis !== undefined;
  }

  getParkingSummary(): string {
    if (this.rule3Data && this.ruleType === 'rule3') {
      const analysis = this.rule3Data.parkingAnalysis;
      return analysis?.validationMessage || 'Parking accessibility compliance check completed';
    }
    return '';
  }

  getParkingDetails(): any {
    if (this.rule3Data && this.ruleType === 'rule3') {
      return {
        total: this.rule3Data.parkingAnalysis?.totalParkingSpaces || 0,
        normal: this.rule3Data.parkingAnalysis?.normalParkingSpaces || 0,
        handicapped: this.rule3Data.parkingAnalysis?.handicappedParkingSpaces || 0,
        required: this.rule3Data.parkingAnalysis?.requiredHandicappedSpaces || 0,
        shortfall: this.rule3Data.parkingAnalysis?.shortfall || 0,
        passed: this.rule3Data.parkingAnalysis?.isValidationPassed || false
      };
    }
    return null;
  }

  isUsingValidationData(): boolean {
    const result = this.validationData !== null;
    console.log('isUsingValidationData called - result:', result);
    console.log('validationData:', this.validationData);
    return result;
  }

  hasEmptyResults(): boolean {
    console.log('hasEmptyResults called');
    console.log('validationData:', this.validationData);
    console.log('rule3Data:', this.rule3Data);
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      // For Rule3 parking data, check if we have parking analysis
      const hasParkingData = this.rule3Data.parkingAnalysis && 
                            (this.rule3Data.normalParkingBreakdown || this.rule3Data.handicappedParkingBreakdown);
      console.log('Rule3 parking data check - hasParkingData:', hasParkingData);
      return !hasParkingData;
    } else if (this.validationData) {
      // For validation data, check if we have validation results
      const hasResults = this.validationData.validationResults && this.validationData.validationResults.length > 0;
      console.log('Validation data check - hasResults:', hasResults);
      console.log('Validation results:', this.validationData.validationResults);
      console.log('Validation results length:', this.validationData.validationResults?.length);
      return !hasResults;
    }
    
    // For legacy rule data structure
    console.log('Using legacy data structure check');
    const results = this.getResults();
    const serviceCheck = this.ruleService.isRuleResultEmpty(this.ruleData!);
    const isEmpty = results.length === 0 || serviceCheck;
    console.log('Legacy check - results length:', results.length, 'serviceCheck:', serviceCheck, 'isEmpty:', isEmpty);
    return isEmpty;
  }

  getEmptyResultsMessage(): string {
    if (this.ruleType === 'rule3') {
      return `No parking elements found in the selected group to validate this rule.`;
    }
    return `No ${this.ruleInfo.category.toLowerCase()} elements found in the selected group to validate this rule.`;
  }

  async getFailedElements(): Promise<Array<{ revitElementId: string }>> {
    console.log('getFailedElements called for ruleType:', this.ruleType);
    
    let failedElements: Array<{ revitElementId: string }> = [];
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      // Handle Rule3 parking data structure
      // For Rule3, since all parking spaces are valid, we don't need to create issues
      // But we can still collect element IDs for highlighting purposes
      const allElementIds: string[] = [];
      
      // Add normal parking element IDs
      if (this.rule3Data.normalParkingBreakdown) {
        Object.values(this.rule3Data.normalParkingBreakdown).forEach(parking => {
          allElementIds.push(...parking.elementIds);
        });
      }
      
      // Add handicapped parking element IDs
      if (this.rule3Data.handicappedParkingBreakdown) {
        Object.values(this.rule3Data.handicappedParkingBreakdown).forEach(parking => {
          allElementIds.push(...parking.elementIds);
        });
      }
      
      // For Rule3, we don't create issues since all are valid, but we can highlight elements
      console.log('Rule3 - Parking elements collected for highlighting:', allElementIds.length);
      
      // Set highlight to true to show the highlight button
      this.highlight = true;
      
      // Return empty array since no failed elements to process
      return [];
    } else if (this.validationData) {
      // Handle new validation data structure
      const failedResults = this.validationData.validationResults.filter(result => !result.isValid);
      failedElements = failedResults.flatMap(result => 
        result.elementIds.map(elementId => ({
          revitElementId: elementId
        }))
      );
    } else {
      // Handle legacy rule data structure
      const results = this.getResults();
      console.log('Results from getResults():', results);
    
      // If no results, return empty array early
      if (results.length === 0) {
        console.log('No results found, returning empty array');
        return [];
      }
    
      failedElements = results
        .filter(result => !result.passed)
        .map(result => ({
          revitElementId: result.revitElementId
        }));
    }
  
    console.log('Failed element count:', failedElements.length);
    console.log('Failed elements:', failedElements);
    
    // Set highlight to true if there are failed elements to highlight
  
    let successfulIssues = 0;
    let processedIssues = 0;
    const totalIssues = failedElements.length;

    // Batch processing configuration
    const BATCH_SIZE = 10; // Process 10 elements at a time
    const BATCH_DELAY = 1000; // 1 second delay between batches

    const showToastIfComplete = () => {
      processedIssues++;
      
      if (processedIssues === totalIssues) {
        if (successfulIssues > 0) {
          const message = successfulIssues === 1 
            ? '1 issue created in ACC' 
            : `${successfulIssues} issues created in ACC`;
          this.toastService.showSuccess(message);
        }
    
        // ✅ Only set highlight once all issues are processed
        this.highlight = true;
      }
    };

    // Process elements in batches
    const processBatch = async (batch: Array<{ revitElementId: string }>) => {
      const batchPromises = batch.map(async (element) => {
        const revitId = element.revitElementId;

        if (!revitId) {
          console.warn('Skipping element due to missing Revit Element ID');
          showToastIfComplete();
          return;
        }

        console.log(`Processing element - Revit Element ID: ${revitId}`);

        try {
          const processResult = await this.viewerService.processModel(revitId);

          if (processResult) {
            console.log(`Processed Revit Element ID ${revitId}:`, processResult);
            const result = this.generateIssuePayloadFromProcessResult(processResult, this.getResults());

            console.log("Issue payload for Revit Element ID", revitId, ":", JSON.stringify(result));
            
            // Make POST request to create issue
            console.log('About to create issue for Revit Element ID:', revitId);
            this.ruleService.createIssue(this.projectId!, this.accUserId, result).subscribe({
              next: (response: any) => {
                console.log('Issue created successfully for Revit Element ID', revitId, ':', response);
                successfulIssues++;
                showToastIfComplete();
              },
              error: (error: any) => {
                console.error('Error creating issue for Revit Element ID', revitId, ':', error);
                showToastIfComplete();
              }
            });
          } else {
            console.warn(`No result returned from processModel for Revit Element ID ${revitId}`);
            showToastIfComplete();
          }
        } catch (error) {
          console.error(`Error processing Revit Element ID ${revitId}:`, error);
          showToastIfComplete();
        }
      });

      // Wait for all elements in the current batch to complete
      await Promise.all(batchPromises);
    };

    // Process all batches with delays
    const processAllBatches = async () => {
      for (let i = 0; i < failedElements.length; i += BATCH_SIZE) {
        const batch = failedElements.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(failedElements.length / BATCH_SIZE)} with ${batch.length} elements`);
        
        await processBatch(batch);
        
        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < failedElements.length) {
          console.log(`Waiting ${BATCH_DELAY}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
    };

    // Start batch processing
    processAllBatches().catch(error => {
      console.error('Error in batch processing:', error);
    });

    return failedElements;
  }
  
  onShowAccIssues() {
    this.showAccIssues.emit(this.getIssuesCreated());
  }

  generateIssuePayloadFromProcessResult(processResult: any, results: any): any {
    const { position, objectId, externalId, viewerState, view } = processResult;
  
    let title = '';
    let description = '';
    
    if (this.rule3Data && this.ruleType === 'rule3') {
      // Handle Rule3 parking data structure
      // Find which parking type this element belongs to
      let parkingType = '';
      let parkingName = '';
      
      // Check normal parking breakdown
      for (const [type, parking] of Object.entries(this.rule3Data.normalParkingBreakdown)) {
        if (parking.elementIds.includes(objectId)) {
          parkingType = 'Normal Parking';
          parkingName = type;
          break;
        }
      }
      
      // Check handicapped parking breakdown
      if (!parkingType) {
        for (const [type, parking] of Object.entries(this.rule3Data.handicappedParkingBreakdown)) {
          if (parking.elementIds.includes(objectId)) {
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
      // Handle new validation data structure
      const validationResult = this.validationData.validationResults.find(result => 
        result.elementIds.includes(objectId)
      );
      
      if (validationResult) {
        title = `Validation Failed - ${view.name}`;
        description = `Type: ${validationResult.typeName}, Family: ${validationResult.familyName}, Width: ${validationResult.widthMm}mm - Failed validation check`;
      } else {
        title = `Validation Failed - ${view.name}`;
        description = `Element validation check failed`;
      }
    } else {
      // Handle legacy rule data structure
      if (this.ruleType === 'rule1') {
        title = `Failed - ${view.name}`;
        description = `${results.find((result: { revitElementId: any; }) => result.revitElementId === objectId)?.message || 'Door clear opening check failed'}`;
      } else if (this.ruleType === 'rule2') {
        title = `Ramp Landing Failed - ${view.name}`;
        description = `${results.find((result: { revitElementId: any; }) => result.revitElementId === objectId)?.message || 'Ramp landing check failed'}`;
      } else if (this.ruleType === 'rule3') {
        title = `Ramp Check Failed - ${view.name}`;
        description = `${results.find((result: { revitElementId: any; }) => result.revitElementId === objectId)?.message || 'Ramp check failed'}`;
      } else if (this.ruleType === 'rule4') {
        title = `Stair Check Failed - ${view.name}`;
        description = `${results.find((result: { revitElementId: any; }) => result.revitElementId === objectId)?.message || 'Stair check failed'}`;
      } else if (this.ruleType === 'rule5') {
        title = `Wall Check Failed - ${view.name}`;
        description = `${results.find((result: { revitElementId: any; }) => result.revitElementId === objectId)?.message || 'Wall check failed'}`;
      }
    }

    return {
      title: title,
      description: description,
      issueSubtypeId: "0d960e5e-92af-4876-b514-aacbbadaca1e", 
      status: "open",
      assignedTo: this.accUserId.toString(), 
      assignedToType: "user",
      dueDate: new Date().toISOString().split('T')[0], 
      startDate: new Date().toISOString().split('T')[0], 
      published: true,
      linkedDocuments: [
        {
          type: "TwoDVectorPushpin",
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
              is3D: view.is3D
            },
            position,
            objectId,
            externalId,
            viewerState: {
              ...viewerState,
              attributesVersion: 2
            }
          }
        }
      ]
    };
  }
  
}