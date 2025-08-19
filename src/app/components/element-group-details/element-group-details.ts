import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
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
import { ViewerService } from '../../services/viewer.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-element-group-details',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ElementsModalComponent, RuleModalComponent, AccIssuesModalComponent],
  templateUrl: './element-group-details.html',
  styleUrl: './element-group-details.scss'
})
export class ElementGroupDetailsComponent implements OnInit, AfterViewInit {
  @ViewChild('viewerContainer', { static: false }) viewerContainer!: ElementRef;
  
  elementGroupId: string = '';
  elementGroupName: string = '';
  accUserId: string = '';
  loading = false;
  fullScreenLoading = true; // Full screen loader for initial page load
  elementGroupData: any = null;
  categories: any[] = [];
  error: string = '';
  showElementsModal = false;
  selectedCategoryName = '';
  showRuleModal = false;
  showEvaluation = false;
  showAccIssuesModal = false;
  accIssuesCount = 0;
  viewer: any = null;
  viewerLoading = false;
  viewerError = '';
  urn = '';
  ruleType: string = 'rule1'; // Track which rule is being checked
  private baseUrl = environment.apiBaseUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentsService: DocumentsService,
    private localService: LocalService,
    private autodeskAuthService: AutodeskAuthService,
    private authService: AuthService,
    private viewerService: ViewerService,
    private http: HttpClient,

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

    // Fallback timeout to hide loader after 10 seconds (in case API calls fail)
    setTimeout(() => {
      if (this.fullScreenLoading) {
        console.warn('ElementGroupDetailsComponent: Full screen loader timeout reached, hiding loader');
        this.fullScreenLoading = false;
      }
    }, 10000);


    

    
    // Get alternativeIdentifiers from query parameters
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(decodeURIComponent(queryParams['alternativeIdentifiers']));
          console.log('ElementGroupDetailsComponent: alternativeIdentifiers from query params:', alternativeIdentifiers);
          this.urn = alternativeIdentifiers.fileVersionUrn;
        } catch (error) {
          console.error('ElementGroupDetailsComponent: Error parsing alternativeIdentifiers:', error);
        }
      } else {
        console.log('ElementGroupDetailsComponent: No alternativeIdentifiers in query params');
      }
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

    this.http.get<any>(`${this.baseUrl}/rule-engine/getDoorData/${this.elementGroupId}?accUserId=${this.accUserId}`).subscribe((response) => {
      if(response){
        // Hide full screen loader after API response
        this.fullScreenLoading = false;
      }
    });

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
        
        // Log alternativeIdentifiers if available
        if (response && response.alternativeIdentifiers) {
          console.log('ElementGroupDetailsComponent: alternativeIdentifiers:', response.alternativeIdentifiers);
        } else {
          console.log('ElementGroupDetailsComponent: No alternativeIdentifiers found in response');
        }
        
        // Extract categories from the response
        if (response && response.distinctPropertyValuesInElementGroupByName && response.distinctPropertyValuesInElementGroupByName.results) {
          this.categories = response.distinctPropertyValuesInElementGroupByName.results;
          console.log('ElementGroupDetailsComponent: Categories extracted:', this.categories);
        } else {
          console.warn('ElementGroupDetailsComponent: No categories found in response');
          this.categories = [];
        }
        
        this.loading = false;
        this.fullScreenLoading = false; // Hide full screen loader after main data loads
      },
      error: (error: any) => {
        console.error('ElementGroupDetailsComponent: Error loading element group details:', error);
        console.error('ElementGroupDetailsComponent: Error details:', error.error || error.message);
        this.error = 'Failed to load element group details';
        this.loading = false;
        this.fullScreenLoading = false; // Hide full screen loader on error
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
    this.ruleType = 'rule1';
    this.showRuleModal = true;
  }

  onRule2Click() {
    console.log('ElementGroupDetailsComponent: Rule 2 button clicked');
    this.ruleType = 'rule2';
    this.showRuleModal = true;
  }

  onRule3Click() {
    console.log('ElementGroupDetailsComponent: Rule 3 button clicked');
    this.ruleType = 'rule3';
    this.showRuleModal = true;
  }

  onRule4Click() {
    console.log('ElementGroupDetailsComponent: Rule 4 button clicked');
    this.ruleType = 'rule4';
    this.showRuleModal = true;
  }

  onRule5Click() {
    console.log('ElementGroupDetailsComponent: Rule 5 button clicked');
    this.ruleType = 'rule5';
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

  ngAfterViewInit() {
    // Use setTimeout to defer viewer initialization and avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.initViewer();
    }, 0);
  }

  initViewer() {
    console.log('ElementGroupDetailsComponent: initViewer called');
    
    if (!this.viewerContainer) {
      console.error('Viewer container not found');
      return;
    }

    const container = this.viewerContainer.nativeElement;
    console.log('ElementGroupDetailsComponent: Viewer container found, dimensions:', {
      width: container.offsetWidth,
      height: container.offsetHeight,
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight
    });

    // Ensure container has proper dimensions
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn('ElementGroupDetailsComponent: Container has zero dimensions, waiting for layout');
      // Wait a bit for layout to complete
      setTimeout(() => {
        this.initViewer();
      }, 100);
      return;
    }

    console.log('ElementGroupDetailsComponent: Viewer container found, starting initialization');
    this.viewerLoading = true;
    this.viewerError = '';

    const id = this.urn;
    const urn = window.btoa(id).replace(/=/g, '')

    this.viewerService.initViewer(container, urn)
      .then((viewer) => {
        console.log('ElementGroupDetailsComponent: Viewer initialized successfully');
        this.viewer = viewer;
        this.viewerLoading = false;
      })
      .catch((error) => {
        console.error('ElementGroupDetailsComponent: Error initializing viewer:', error);
        this.viewerError = 'Failed to load 3D viewer: ' + (error.message || error);
        this.viewerLoading = false;
      });
  }
} 