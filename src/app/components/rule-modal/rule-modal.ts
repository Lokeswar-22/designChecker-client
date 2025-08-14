import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuleService, RuleCheckResponse } from '../../services/rule.service';
import { LocalService } from '../../services/local.service';
import { ViewerService } from '../../services/viewer.service';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';

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
    // Reset to acknowledgement state when modal becomes visible
    if (this.isVisible) {
      this.showAcknowledgement = true;
      this.loading = false;
      this.error = '';
      this.ruleData = null;
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
          title: 'Rule 1 - Door Clear Opening Check',
          description: 'Ensures accessible doors meet the minimum clear opening width required for wheelchair accessibility.',
          executionInfo: 'Fetches all door elements from AEC Data Model (category = Doors). Checks width using properties like Door Opening Width, Clear Opening Width, Width, MF Opening Width, Rough Width, Panel Width. Compares against the threshold.',
          category: 'Doors',
          thresholds: {
            minimum: 850,
            maximum: null,
            unit: 'mm',
            requirement: 'Clear opening width must be at least 850 mm'
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
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 1: No elements found to validate');
        }
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
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
    
    this.ruleService.checkRule2(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 2 check response:', response);
        this.ruleData = response;
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 2: No elements found to validate');
        }
        
        console.log('About to call getFailedElements for Rule 2');
        console.log('URN before getFailedElements:', this.urn);
        console.log('ProjectId before getFailedElements:', this.projectId);
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        console.log('getFailedElements completed for Rule 2');
    },
    error: (error: any) => {
      console.error('Error checking rule 2:', error);
      this.error = 'Failed to check rule 2. Please try again.';
      this.loading = false;
    }
  });
  }

  checkRule3() {
    console.log('checkRule3 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
    this.ruleService.checkRule3(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 3 check response:', response);
        this.ruleData = response;
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 3: No elements found to validate');
        }
        
        console.log('About to call getFailedElements for Rule 3');
        console.log('URN before getFailedElements:', this.urn);
        console.log('ProjectId before getFailedElements:', this.projectId);
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        console.log('getFailedElements completed for Rule 3');
    },
    error: (error: any) => {
      console.error('Error checking rule 3:', error);
      this.error = 'Failed to check rule 3. Please try again.';
      this.loading = false;
    }
  });
  }

  checkRule4() {
    console.log('checkRule4 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
    this.ruleService.checkRule4(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 4 check response:', response);
        this.ruleData = response;
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 4: No elements found to validate');
        }
        
        console.log('About to call getFailedElements for Rule 4');
        console.log('URN before getFailedElements:', this.urn);
        console.log('ProjectId before getFailedElements:', this.projectId);
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        console.log('getFailedElements completed for Rule 4');
    },
    error: (error: any) => {
      console.error('Error checking rule 4:', error);
      this.error = 'Failed to check rule 4. Please try again.';
      this.loading = false;
    }
  });
  }

  checkRule5() {
    console.log('checkRule5 called with:', {
      elementGroupId: this.elementGroupId,
      accUserId: this.accUserId,
      projectId: this.projectId,
      urn: this.urn
    });
    
    this.ruleService.checkRule5(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: async (response: RuleCheckResponse) => {
        console.log('Rule 5 check response:', response);
        this.ruleData = response;
        this.loading = false;
        
        // Log empty results check
        if (this.hasEmptyResults()) {
          console.log('Rule 5: No elements found to validate');
        }
        
        console.log('About to call getFailedElements for Rule 5');
        console.log('URN before getFailedElements:', this.urn);
        console.log('ProjectId before getFailedElements:', this.projectId);
        
        // Process failed elements after rule check is complete
        await this.getFailedElements();
        console.log('getFailedElements completed for Rule 5');
    },
    error: (error: any) => {
      console.error('Error checking rule 5:', error);
      this.error = 'Failed to check rule 5. Please try again.';
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
    if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.summary?.totalPassed || 0;
    } else {
      return this.ruleData?.summary?.totalPassed || 0;
    }
  }

  getFailedCount(): number {
    if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.summary?.totalFailed || 0;
    } else {
      return this.ruleData?.summary?.totalFailed || 0;
    }
  }

  getTotalCount(): number {
    if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.summary?.totalElementsChecked || 0;
    } else {
      return this.ruleData?.summary?.totalElementsChecked || 0;
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
    if (this.ruleType === 'rule1') {
      return this.ruleData?.result?.results || [];
    } else {
      return this.ruleData?.results || [];
    }
  }

  hasEmptyResults(): boolean {
    const results = this.getResults();
    const serviceCheck = this.ruleService.isRuleResultEmpty(this.ruleData!);
    return results.length === 0 || serviceCheck;
  }

  getEmptyResultsMessage(): string {
    return `No ${this.ruleInfo.category.toLowerCase()} elements found in the selected group to validate this rule.`;
  }

  async getFailedElements(): Promise<Array<{ revitElementId: string, ifcGUID: string | null }>> {
    console.log('getFailedElements called for ruleType:', this.ruleType);
    
    const results = this.getResults();
    console.log('Results from getResults():', results);
  
    // If no results, return empty array early
    if (results.length === 0) {
      console.log('No results found, returning empty array');
      return [];
    }
  
    const failedElements = results
      .filter(result => !result.passed)
      .map(result => ({
        revitElementId: result.revitElementId,
        ifcGUID: result.ifcGUID
      }));
  
    console.log('Failed element count:', failedElements.length);
    console.log('Failed elements:', failedElements);
    
    // Set highlight to true if there are failed elements to highlight
  
    let successfulIssues = 0;
    let processedIssues = 0;
    const totalIssues = failedElements.length;
  
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
    
  
    for (const element of failedElements) {
      const revitId = element.revitElementId;
  
      if (!revitId) {
        console.warn('Skipping element due to missing Revit Element ID');
        showToastIfComplete();
        continue;
      }
  
      console.log(`Processing element - Revit Element ID: ${revitId}`);
  
      try {
        const processResult = await this.viewerService.processModel(revitId);
  
        if (processResult) {
          console.log(`Processed Revit Element ID ${revitId}:`, processResult);
          const result = this.generateIssuePayloadFromProcessResult(processResult, results);

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
    }
  
    return failedElements;
  }
  
  onShowAccIssues() {
    this.showAccIssues.emit(this.getIssuesCreated());
  }

  generateIssuePayloadFromProcessResult(processResult: any, results:any): any {
    const { position, objectId, externalId, viewerState, view } = processResult;
  
    let title = '';
    let description = '';
    
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