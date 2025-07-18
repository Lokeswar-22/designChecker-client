import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuleService, RuleCheckResponse } from '../../services/rule.service';
import { LocalService } from '../../services/local.service';

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
  @Output() close = new EventEmitter<void>();
  @Output() showAccIssues = new EventEmitter<number>();
  projectId: string | null = null;

  loading = false;
  ruleData: RuleCheckResponse | null = null;
  error: string = '';

  constructor(private ruleService: RuleService,
    private localService: LocalService
  ) {}

  ngOnInit() {
    if (this.isVisible && this.elementGroupId && this.accUserId) {
      this.checkRule1();
    }
    const projectName = this.localService.getProjectName();
    
    if (projectName && this.accUserId) {
      this.ruleService.getProjectById(this.accUserId, projectName).subscribe({
        next: (response) => {
          console.log('Project by ID API response:', response);
          this.projectId = response.projectId.split('.')[1];
          console.log("PROJECT ID",this.projectId)
        },
        error: (error) => {
          console.error('Error calling project by ID API:', error);
        }
      });
    }
  }

  ngOnChanges() {
    if (this.isVisible && this.elementGroupId && this.accUserId) {
      this.checkRule1();
    }
  }

  checkRule1() {
    this.loading = true;
    this.error = '';
    this.ruleData = null;

   

      this.ruleService.checkRule1(this.elementGroupId, this.accUserId, this.projectId!).subscribe({
        next: (response: RuleCheckResponse) => {
          console.log('Rule check response:', response);
          this.ruleData = response;
          this.loading = false;
      },
      error: (error: any) => {
        console.error('Error checking rule:', error);
        this.error = 'Failed to check rule. Please try again.';
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
    return this.ruleData?.summary?.totalPassed || 0;
  }

  getFailedCount(): number {
    return this.ruleData?.summary?.totalFailed || 0;
  }

  getTotalCount(): number {
    return this.ruleData?.summary?.totalElementsChecked || 0;
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
    return this.ruleData?.results || [];
  }

  onShowAccIssues() {
    this.showAccIssues.emit(this.getIssuesCreated());
  }
} 