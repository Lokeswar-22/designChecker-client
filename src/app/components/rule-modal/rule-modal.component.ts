import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
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
  templateUrl: './rule-modal.component.html',
  styleUrl: './rule-modal.component.scss'
})
export class RuleModalComponent implements OnInit, OnChanges {
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
      requirement: null
    }
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
        error: () => {}
      });
    }

    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(decodeURIComponent(queryParams['alternativeIdentifiers']));
          this.urn = alternativeIdentifiers.fileUrn;
        } catch (error) {}
      }
    });
  }

  ngOnChanges() {
    if (this.isVisible) {
      this.showAcknowledgement = true;
      this.loading = false;
      this.error = '';
      this.ruleData = null;
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

    const ruleCheckMap: { [key: string]: () => void } = {
      'rule1': () => this.checkRule1(),
      'rule2': () => this.checkRule2(),
      'rule3': () => this.checkRule3(),
      'rule4': () => this.checkRule4(),
      'rule5': () => this.checkRule5()
    };

    if (ruleCheckMap[this.ruleType]) {
      ruleCheckMap[this.ruleType]();
    }
  }

  private handleRuleResponse(response: RuleCheckResponse) {
    this.ruleData = response;
    this.loading = false;
    this.getFailedElements();
  }

  private handleRuleError() {
    this.error = `Failed to check ${this.ruleType}. Please try again.`;
    this.loading = false;
  }

  checkRule1() {
    this.ruleService.checkRule1(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: (response) => this.handleRuleResponse(response),
      error: () => this.handleRuleError()
    });
  }

  checkRule2() {
    this.ruleService.checkRule2(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: (response) => this.handleRuleResponse(response),
      error: () => this.handleRuleError()
    });
  }

  checkRule3() {
    this.ruleService.checkRule3(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: (response) => this.handleRuleResponse(response),
      error: () => this.handleRuleError()
    });
  }

  checkRule4() {
    this.ruleService.checkRule4(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: (response) => this.handleRuleResponse(response),
      error: () => this.handleRuleError()
    });
  }

  checkRule5() {
    this.ruleService.checkRule5(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
      next: (response) => this.handleRuleResponse(response),
      error: () => this.handleRuleError()
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
    return (this.ruleType === 'rule1' ? this.ruleData?.result?.summary?.totalPassed : this.ruleData?.summary?.totalPassed) || 0;
  }

  getFailedCount(): number {
    return (this.ruleType === 'rule1' ? this.ruleData?.result?.summary?.totalFailed : this.ruleData?.summary?.totalFailed) || 0;
  }

  getTotalCount(): number {
    return (this.ruleType === 'rule1' ? this.ruleData?.result?.summary?.totalElementsChecked : this.ruleData?.summary?.totalElementsChecked) || 0;
  }

  getPassPercentage(): number {
    const total = this.getTotalCount();
    return total === 0 ? 0 : Math.round((this.getPassedCount() / total) * 100);
  }

  getIssuesCreated(): number {
    return this.ruleData?.issuesCreated || 0;
  }

  getResults(): any[] {
    return (this.ruleType === 'rule1' ? this.ruleData?.result?.results : this.ruleData?.results) || [];
  }

  async getFailedElements(): Promise<any[]> {
    const results = this.getResults();
    const failedElements = results.filter(result => !result.passed).map(result => ({
      revitElementId: result.revitElementId,
      ifcGUID: result.ifcGUID
    }));

    if (failedElements.length === 0) return [];

    let successfulIssues = 0;
    let processedIssues = 0;
    const totalIssues = failedElements.length;

    const showToastIfComplete = () => {
      processedIssues++;
      if (processedIssues === totalIssues) {
        if (successfulIssues > 0) {
          const message = successfulIssues === 1 ? '1 issue created in ACC' : `${successfulIssues} issues created in ACC`;
          this.toastService.showSuccess(message);
        }
        this.highlight = true;
      }
    };

    failedElements.forEach(async (element) => {
      if (!element.revitElementId) {
        showToastIfComplete();
        return;
      }

      try {
        const processResult = await this.viewerService.processModel(element.revitElementId);
        if (processResult) {
          const result = this.generateIssuePayloadFromProcessResult(processResult, results);
          this.ruleService.createIssue(this.projectId!, this.accUserId, result).subscribe({
            next: () => {
              successfulIssues++;
              showToastIfComplete();
            },
            error: () => showToastIfComplete()
          });
        } else {
          showToastIfComplete();
        }
      } catch (error) {
        showToastIfComplete();
      }
    });

    return failedElements;
  }

  onShowAccIssues() {
    this.showAccIssues.emit(this.getIssuesCreated());
  }

  generateIssuePayloadFromProcessResult(processResult: any, results: any): any {
    const { position, objectId, externalId, viewerState, view } = processResult;
    const ruleTitles: { [key: string]: string } = {
      'rule1': 'Door clear opening check failed',
      'rule2': 'Ramp landing check failed',
      'rule3': 'Ramp check failed',
      'rule4': 'Stair check failed',
      'rule5': 'Wall check failed'
    };

    const title = this.ruleType === 'rule1' ? `Failed - ${view.name}` : `${this.ruleType.charAt(0).toUpperCase() + this.ruleType.slice(1)} Check Failed - ${view.name}`;
    const description = results.find((result: any) => result.revitElementId === objectId)?.message || ruleTitles[this.ruleType];

    return {
      title,
      description,
      issueSubtypeId: "0d960e5e-92af-4876-b514-aacbbadaca1e",
      status: "open",
      assignedTo: this.accUserId.toString(),
      assignedToType: "user",
      dueDate: new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      published: true,
      linkedDocuments: [{
        type: "TwoDVectorPushpin",
        urn: this.urn,
        createdBy: this.accUserId.toString(),
        createdAt: new Date().toISOString(),
        createdAtVersion: 1,
        details: {
          viewable: view,
          position,
          objectId,
          externalId,
          viewerState: { ...viewerState, attributesVersion: 2 }
        }
      }]
    };
  }
}

