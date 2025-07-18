import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RuleService, Issue, IssuesResponse } from '../../services/rule.service';

@Component({
  selector: 'app-acc-issues-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acc-issues-modal.html',
  styleUrl: './acc-issues-modal.scss'
})
export class AccIssuesModalComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Input() issuesCount: number = 0;
  @Output() close = new EventEmitter<void>();

  loading = false;
  error: string = '';
  issues: Issue[] = [];
  totalIssues = 0;

  constructor(private ruleService: RuleService) {}

  ngOnInit() {
    if (this.isVisible) {
      this.loadIssues();
    }
  }

  ngOnChanges() {
    if (this.isVisible) {
      this.loadIssues();
    }
  }

  loadIssues() {
    this.loading = true;
    this.error = '';
    
    this.ruleService.getIssues().subscribe({
      next: (response: IssuesResponse) => {
        this.issues = response.results;
        this.totalIssues = response.pagination.totalResults;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading issues:', error);
        this.error = 'Failed to load issues. Please try again.';
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

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'open':
        return 'status-open';
      case 'closed':
        return 'status-closed';
      case 'pending':
        return 'status-pending';
      case 'in_review':
        return 'status-in-review';
      case 'draft':
        return 'status-draft';
      default:
        return 'status-open';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
} 