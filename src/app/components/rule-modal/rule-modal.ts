import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuleService, RuleCheckResponse } from '../../services/rule.service';
import { LocalService } from '../../services/local.service';
import { ViewerService } from '../../services/viewer.service';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';

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

  constructor(private ruleService: RuleService,
    private localService: LocalService,
    private viewerService: ViewerService,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    const projectName = this.localService.getProjectName();
    
    if (projectName && this.accUserId) {
      this.ruleService.getProjectById(this.accUserId, projectName).subscribe({
        next: (response) => {
          console.log('Project by ID API response:', response);
          this.projectId = response.projectId.split('.')[1];
          console.log("PROJECT ID",this.projectId)
          
          // Now that projectId is available, check the rule if modal is visible
          if (this.isVisible && this.elementGroupId && this.accUserId) {
            this.checkRule();
          }
        },
        error: (error) => {
          console.error('Error calling project by ID API:', error);
        }
      });
    } else {
      // If no project name or accUserId, still try to check rule (for testing)
      if (this.isVisible && this.elementGroupId && this.accUserId) {
        this.checkRule();
      }
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
    // Only check rule if we have all required data and projectId is available
    if (this.isVisible && this.elementGroupId && this.accUserId && this.projectId) {
      this.checkRule();
    }
  }

  checkRule() {
    this.loading = true;
    this.error = '';
    this.ruleData = null;

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
    this.close.emit();
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

  async getFailedElements(): Promise<Array<{ revitElementId: string, ifcGUID: string | null }>> {
    console.log('getFailedElements called for ruleType:', this.ruleType);
    const results = this.getResults();
    console.log('Results from getResults():', results);
  
    const failedElements = results
      .filter(result => !result.passed)
      .map(result => ({
        revitElementId: result.revitElementId,
        ifcGUID: result.ifcGUID
      }));
  
    console.log('Failed element count:', failedElements.length);
    console.log('Failed elements:', failedElements);
  
    let successfulIssues = 0;
    let processedIssues = 0;
    const totalIssues = failedElements.length;
  
    const showToastIfComplete = () => {
      processedIssues++;
      if (processedIssues === totalIssues && successfulIssues > 0) {
        const message = successfulIssues === 1 
          ? '1 issue created in ACC' 
          : `${successfulIssues} issues created in ACC`;
        this.toastService.showSuccess(message);
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