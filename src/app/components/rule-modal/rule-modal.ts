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
}

interface FailureBreakdown {
  [key: string]: number;
}

interface ValidationResponse {
  validationResults: ValidationResult[];
  summary: ValidationSummary;
  failureBreakdown: FailureBreakdown;
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
          title: 'Rule 1 - Door Type Validation Check',
          description: 'Validates door types and families against accessibility requirements, ensuring proper categorization and compliance.',
          executionInfo: 'Analyzes all door elements from the AEC Data Model, categorizing them by type and family. Validates door dimensions and creates ACC issues for non-compliant elements.',
          category: 'Doors',
          thresholds: {
            minimum: 'Compliance with accessibility standards',
            maximum: null,
            unit: 'Validation',
            requirement: 'Door types must meet accessibility requirements and be properly categorized'
          }
        };
        break;
      case 'rule2':
        this.ruleInfo = {
          title: 'Rule 2 - Ramp Landing Check',
          description: 'Validates that ramps have level landings at the top, bottom, and changes in direction, ensuring accessibility and safety.',
          executionInfo: 'Fetches ramp elements (category = Ramps). Uses Base Offset and Top Offset properties to verify that landings are level. Flags ramps with missing or inconsistent landing data.',
          category: 'Ramps',
          thresholds: {
            minimum: 0,
            maximum: 0,
            unit: 'mm (level difference)',
            requirement: 'Landings must be level at top and bottom of each ramp run'
          }
        };
        break;
      case 'rule3':
        this.ruleInfo = {
          title: 'Rule 3 - Ramp Gradient Check',
          description: 'Ensures ramps comply with slope regulations for accessibility. The gradient must meet requirements in Table 4 of the BCA Code.',
          executionInfo: 'Fetches ramp elements (category = Ramps). Uses Ramp Max Slope (1/x) property to check compliance. Compares slope against Table 4 permissible limits.',
          category: 'Ramps',
          thresholds: {
            minimum: null,
            maximum: '1/x (per BCA Table 4)',
            unit: 'gradient ratio',
            requirement: 'Ramp slope must comply with BCA Table 4 and be consistent between landings'
          }
        };
        break;
      case 'rule4':
        this.ruleInfo = {
          title: 'Rule 4 - Stair Handrail Height Check',
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
          title: 'Rule 5 - Accessible Washroom Dimension Check',
          description: 'Validates that accessible washrooms have sufficient clear dimensions and transfer space for wheelchair use.',
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
    console.log('checkRule2 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
  //   this.ruleService.checkRule2(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
  //     next: async (response: RuleCheckResponse) => {
  //       console.log('Rule 2 check response:', response);
  //       this.ruleData = response;
  //       this.loading = false;
        
  //       // Log empty results check
  //       if (this.hasEmptyResults()) {
  //         console.log('Rule 2: No elements found to validate');
  //       }
        
  //       console.log('About to call getFailedElements for Rule 2');
  //       console.log('URN before getFailedElements:', this.urn);
  //       console.log('ProjectId before getFailedElements:', this.projectId);
        
  //       // Process failed elements after rule check is complete
  //       await this.getFailedElements();
  //       console.log('getFailedElements completed for Rule 2');
  //   },
  //   error: (error: any) => {
  //     console.error('Error checking rule 2:', error);
  //     this.error = 'Failed to check rule 2. Please try again.';
  //     this.loading = false;
  //   }
  // });
  }

  checkRule3() {
    console.log('checkRule3 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
  //   this.ruleService.checkRule3(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
  //     next: async (response: RuleCheckResponse) => {
  //       console.log('Rule 3 check response:', response);
  //       this.ruleData = response;
  //       this.loading = false;
        
  //       // Log empty results check
  //       if (this.hasEmptyResults()) {
  //         console.log('Rule 3: No elements found to validate');
  //       }
        
  //       console.log('About to call getFailedElements for Rule 3');
  //       console.log('URN before getFailedElements:', this.urn);
  //       console.log('ProjectId before getFailedElements:', this.projectId);
        
  //       // Process failed elements after rule check is complete
  //       await this.getFailedElements();
  //       console.log('getFailedElements completed for Rule 3');
  //   },
  //   error: (error: any) => {
  //     console.error('Error checking rule 3:', error);
  //     this.error = 'Failed to check rule 3. Please try again.';
  //     this.loading = false;
  //   }
  // });
  }

  checkRule4() {
    console.log('checkRule4 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
  //   this.ruleService.checkRule4(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
  //     next: async (response: RuleCheckResponse) => {
  //       console.log('Rule 4 check response:', response);
  //       this.ruleData = response;
  //       this.loading = false;
        
  //       // Log empty results check
  //       if (this.hasEmptyResults()) {
  //         console.log('Rule 4: No elements found to validate');
  //       }
        
  //       console.log('About to call getFailedElements for Rule 4');
  //       console.log('URN before getFailedElements:', this.urn);
  //       console.log('ProjectId before getFailedElements:', this.projectId);
        
  //       // Process failed elements after rule check is complete
  //       await this.getFailedElements();
  //       console.log('getFailedElements completed for Rule 4');
  //   },
  //   error: (error: any) => {
  //     console.error('Error checking rule 4:', error);
  //     this.error = 'Failed to check rule 4. Please try again.';
  //     this.loading = false;
  //   }
  // });
  }

  checkRule5() {
    console.log('checkRule5 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
  //   this.ruleService.checkRule5(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
  //     next: async (response: RuleCheckResponse) => {
  //       console.log('Rule 5 check response:', response);
  //       this.ruleData = response;
  //       this.loading = false;
        
  //       // Log empty results check
  //       if (this.hasEmptyResults()) {
  //         console.log('Rule 5: No elements found to validate');
  //       }
        
  //       console.log('About to call getFailedElements for Rule 5');
  //       console.log('URN before getFailedElements:', this.urn);
  //       console.log('ProjectId before getFailedElements:', this.projectId);
        
  //       // Process failed elements after rule check is complete
  //       await this.getFailedElements();
  //       console.log('getFailedElements completed for Rule 5');
  //   },
  //   error: (error: any) => {
  //     console.error('Error checking rule 5:', error);
  //     this.error = 'Failed to check rule 5. Please try again.';
  //     this.loading = false;
  //   }
  // });
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
    
    if (this.validationData) {
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
    
    if (this.validationData) {
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
    
    if (this.validationData) {
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
    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getPassedCount() / total) * 100);
  }

  getIssuesCreated(): number {
    return this.ruleData?.issuesCreated || 0;
  }

  getResults(): any[] {
    console.log('getResults called');
    console.log('validationData exists:', !!this.validationData);
    
    if (this.validationData) {
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

  isUsingValidationData(): boolean {
    const result = this.validationData !== null;
    console.log('isUsingValidationData called - result:', result);
    console.log('validationData:', this.validationData);
    return result;
  }

  hasEmptyResults(): boolean {
    console.log('hasEmptyResults called');
    console.log('validationData:', this.validationData);
    
    if (this.validationData) {
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
    return `No ${this.ruleInfo.category.toLowerCase()} elements found in the selected group to validate this rule.`;
  }

  async getFailedElements(): Promise<Array<{ revitElementId: string }>> {
    console.log('getFailedElements called for ruleType:', this.ruleType);
    
    let failedElements: Array<{ revitElementId: string }> = [];
    
    if (this.validationData) {
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
    
    if (this.validationData) {
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