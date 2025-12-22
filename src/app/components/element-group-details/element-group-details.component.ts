import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ElementsModalComponent } from '../elements-modal/elements-modal.component';
import { RuleModalComponent } from '../rule-modal/rule-modal.component';
import { AccIssuesModalComponent } from '../acc-issues-modal/acc-issues-modal.component';
import { DocumentsService } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { AuthService } from '../../services/auth.service';
import { ViewerService } from '../../services/viewer.service';

@Component({
  selector: 'app-element-group-details',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, ElementsModalComponent, RuleModalComponent, AccIssuesModalComponent],
  templateUrl: './element-group-details.component.html',
  styleUrl: './element-group-details.component.scss'
})
export class ElementGroupDetailsComponent implements OnInit, AfterViewInit {
  @ViewChild('viewerContainer', { static: false }) viewerContainer!: ElementRef;

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
  viewer: any = null;
  viewerLoading = false;
  viewerError = '';
  urn = '';
  ruleType: string = 'rule1';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentsService: DocumentsService,
    private localService: LocalService,
    private autodeskAuthService: AutodeskAuthService,
    private authService: AuthService,
    private viewerService: ViewerService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.elementGroupId = params['elementGroupId'];
      this.elementGroupName = params['elementGroupName'];
    });

    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(decodeURIComponent(queryParams['alternativeIdentifiers']));
          this.urn = alternativeIdentifiers.fileVersionUrn;
        } catch (error) {
          // Silent error handling for cleaner code
        }
      }
    });

    const userData = this.localService.getUserData();
    this.accUserId = userData?.accUserId || '';

    if (!this.accUserId) {
      const authStatus = this.autodeskAuthService.getAuthStatus();
      this.accUserId = authStatus.accUserId || '';
    }

    if (this.elementGroupId && this.accUserId) {
      this.loadElementGroupDetails();
    } else {
      this.error = 'Missing required parameters';
    }
  }

  loadElementGroupDetails() {
    this.loading = true;
    this.error = '';

    this.documentsService.getElementGroupDetails(this.elementGroupId, this.accUserId).subscribe({
      next: (response: any) => {
        this.elementGroupData = response;
        if (response?.distinctPropertyValuesInElementGroupByName?.results) {
          this.categories = response.distinctPropertyValuesInElementGroupByName.results;
        } else {
          this.categories = [];
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load element group details';
        this.loading = false;
      }
    });
  }

  onBackToDocuments() {
    this.router.navigate(['/documents']);
  }

  getTotalCount(category: any): number {
    if (!category.values) return 0;
    return category.values.reduce((total: number, item: any) => total + (item.count || 0), 0);
  }

  onValueCardClick(value: any) {
    this.selectedCategoryName = value.value;
    this.showElementsModal = true;
  }

  onCloseElementsModal() {
    this.showElementsModal = false;
    this.selectedCategoryName = '';
  }

  onRule1Click() {
    this.ruleType = 'rule1';
    this.showRuleModal = true;
  }

  onRule2Click() {
    this.ruleType = 'rule2';
    this.showRuleModal = true;
  }

  onRule3Click() {
    this.ruleType = 'rule3';
    this.showRuleModal = true;
  }

  onRule4Click() {
    this.ruleType = 'rule4';
    this.showRuleModal = true;
  }

  onRule5Click() {
    this.ruleType = 'rule5';
    this.showRuleModal = true;
  }

  onCloseRuleModal() {
    this.showRuleModal = false;
  }

  onShowAccIssues(issuesCount: number) {
    this.accIssuesCount = issuesCount;
    this.showAccIssuesModal = true;
  }

  onCloseAccIssuesModal() {
    this.showAccIssuesModal = false;
    this.accIssuesCount = 0;
  }

  toggleEvaluation() {
    this.showEvaluation = !this.showEvaluation;
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initViewer();
    }, 0);
  }

  initViewer() {
    if (!this.viewerContainer) return;

    const container = this.viewerContainer.nativeElement;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      setTimeout(() => this.initViewer(), 100);
      return;
    }

    this.viewerLoading = true;
    this.viewerError = '';

    const urn = window.btoa(this.urn)
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    this.viewerService.initViewer(container, urn)
      .then((viewer) => {
        this.viewer = viewer;
        this.viewerLoading = false;
      })
      .catch((error) => {
        this.viewerError = 'Failed to load 3D viewer: ' + (error.message || error);
        this.viewerLoading = false;
      });
  }
}

