import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../header/header';
import { SidebarComponent } from '../sidebar/sidebar';
import { ElementsModalComponent } from '../elements-modal/elements-modal';
import { RuleModalComponent } from '../rule-modal/rule-modal';
import { AccIssuesModalComponent } from '../acc-issues-modal/acc-issues-modal';
import { DocumentsService } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-element-group-details',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ElementsModalComponent, RuleModalComponent, AccIssuesModalComponent],
  templateUrl: './element-group-details.html',
  styleUrl: './element-group-details.scss'
})
export class ElementGroupDetailsComponent implements OnInit {
  elementGroupId: string = '';
  elementGroupName: string = '';
  accUserId: string = '';
  loading = false;
  elementGroupData: any = null;
  categories: any[] = [];
  error: string = '';
  showElementsModal = false;
  selectedCategoryName = '';
  showRuleModal = false;
  showEvaluation = false;
  showAccIssuesModal = false;
  accIssuesCount = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentsService: DocumentsService,
    private localService: LocalService,
    private autodeskAuthService: AutodeskAuthService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    console.log('ElementGroupDetailsComponent: ngOnInit called - component loaded!');
    
    // Get elementGroupId from route parameters
    this.route.params.subscribe(params => {
      this.elementGroupId = params['elementGroupId'];
      this.elementGroupName = params['elementGroupName'];
      console.log('ElementGroupDetailsComponent: elementGroupId from route:', this.elementGroupId);
      console.log('ElementGroupDetailsComponent: elementGroupName from route:', this.elementGroupName);
    });
    
    // Get accUserId from local storage or other source
    const userData = this.localService.getUserData();
    this.accUserId = userData?.accUserId || '';
    console.log('ElementGroupDetailsComponent: User data from storage:', userData);
    console.log('ElementGroupDetailsComponent: accUserId from storage:', this.accUserId);
    
    // If no accUserId in storage, try to get it from Autodesk auth service
    if (!this.accUserId) {
      const authStatus = this.autodeskAuthService.getAuthStatus();
      this.accUserId = authStatus.accUserId || '';
      console.log('ElementGroupDetailsComponent: accUserId from Autodesk auth service:', this.accUserId);
    }
    
    if (!this.accUserId) {
      console.warn('ElementGroupDetailsComponent: No accUserId found in any source');
    }
    
    // Log the required parameters
    console.log('ElementGroupDetailsComponent: elementGroupId:', this.elementGroupId);
    console.log('ElementGroupDetailsComponent: accUserId:', this.accUserId);
    
    // Load element group details
    if (this.elementGroupId && this.accUserId) {
      this.loadElementGroupDetails();
    } else {
      console.error('ElementGroupDetailsComponent: Missing required parameters');
      this.error = 'Missing required parameters';
    }
  }

  loadElementGroupDetails() {
    console.log('ElementGroupDetailsComponent: Loading element group details...');
    console.log('ElementGroupDetailsComponent: elementGroupId:', this.elementGroupId);
    console.log('ElementGroupDetailsComponent: accUserId:', this.accUserId);
    
    this.loading = true;
    this.error = '';

    // Call the service to get element group details
    this.documentsService.getElementGroupDetails(this.elementGroupId, this.accUserId).subscribe({
      next: (response: any) => {
        console.log('ElementGroupDetailsComponent: Element group details response:', response);
        this.elementGroupData = response;
        
        // Extract categories from the response
        if (response && response.distinctPropertyValuesInElementGroupByName && response.distinctPropertyValuesInElementGroupByName.results) {
          this.categories = response.distinctPropertyValuesInElementGroupByName.results;
          console.log('ElementGroupDetailsComponent: Categories extracted:', this.categories);
        } else {
          console.warn('ElementGroupDetailsComponent: No categories found in response');
          this.categories = [];
        }
        
        this.loading = false;
      },
      error: (error: any) => {
        console.error('ElementGroupDetailsComponent: Error loading element group details:', error);
        console.error('ElementGroupDetailsComponent: Error details:', error.error || error.message);
        this.error = 'Failed to load element group details';
        this.loading = false;
      }
    });
  }

  onBackToDocuments() {
    console.log('ElementGroupDetailsComponent: Navigating back to documents');
    this.router.navigate(['/documents']);
  }

  getTotalCount(category: any): number {
    if (!category.values) return 0;
    return category.values.reduce((total: number, item: any) => total + (item.count || 0), 0);
  }

  onValueCardClick(value: any) {
    console.log('ElementGroupDetailsComponent: Value card clicked:', value);
    this.selectedCategoryName = value.value;
    this.showElementsModal = true;
  }

  onCloseElementsModal() {
    console.log('ElementGroupDetailsComponent: Elements modal closed');
    this.showElementsModal = false;
    this.selectedCategoryName = '';
  }

  onRule1Click() {
    console.log('ElementGroupDetailsComponent: Rule 1 button clicked');
    this.showRuleModal = true;
  }

  onCloseRuleModal() {
    console.log('ElementGroupDetailsComponent: Rule modal closed');
    this.showRuleModal = false;
  }

  onShowAccIssues(issuesCount: number) {
    console.log('ElementGroupDetailsComponent: Show ACC issues clicked, count:', issuesCount);
    this.accIssuesCount = issuesCount;
    this.showAccIssuesModal = true;
  }

  onCloseAccIssuesModal() {
    console.log('ElementGroupDetailsComponent: ACC issues modal closed');
    this.showAccIssuesModal = false;
    this.accIssuesCount = 0;
  }

  toggleEvaluation() {
    console.log('ElementGroupDetailsComponent: Evaluation toggle clicked');
    this.showEvaluation = !this.showEvaluation;
  }
} 