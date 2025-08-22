import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { DocumentsService } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { ViewerService } from '../../services/viewer.service';
import { AccIssuesModalComponent } from '../acc-issues-modal/acc-issues-modal';
import { ElementsModalComponent } from '../elements-modal/elements-modal';
import { HeaderComponent } from '../header/header';
import { RuleModalComponent } from '../rule-modal/rule-modal';
import { SidebarComponent } from '../sidebar/sidebar';

type RuleName = 'Rule1' | 'Rule2' | 'Rule3' | 'Rule4' | 'Rule5';

@Component({
  selector: 'app-element-group-details',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    ElementsModalComponent,
    RuleModalComponent,
    AccIssuesModalComponent,
  ],
  templateUrl: './element-group-details.html',
  styleUrl: './element-group-details.scss',
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
  isLoading = false;
  compact = false;

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
    private http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params) => {
      this.elementGroupId = params['elementGroupId'];
      this.elementGroupName = params['elementGroupName'];
      console.log(
        'ElementGroupDetailsComponent: elementGroupId from route:',
        this.elementGroupId
      );
    });

    this.route.queryParams.subscribe((queryParams) => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(
            decodeURIComponent(queryParams['alternativeIdentifiers'])
          );
          this.urn = alternativeIdentifiers.fileVersionUrn;
        } catch (error) {
          console.error(
            'ElementGroupDetailsComponent: Error parsing alternativeIdentifiers:',
            error
          );
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
    const mainUrl = `${this.baseUrl}/rule-data/checkRuleData/${this.elementGroupId}?accUserId=${this.accUserId}`;
    this.http
      .get<{ message: string }>(mainUrl)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          const needs = this.parseNoDataList(res?.message ?? '');

          if (needs.length === 0) {
            // Success => no spinner, no sub-calls
            return;
          }

          this.isLoading = true;
          const calls = needs.map((rule) => this.apiForRule(rule));

          forkJoin(calls)
            .pipe(finalize(() => (this.isLoading = false)))
            .subscribe({
              next: (responses) => {
                responses.forEach((r, i) =>
                  console.log(`${needs[i]} response:`, r)
                );
              },
              error: (err) => console.error('Rule sub-call error:', err),
            });
        },
        error: (err) => console.error('Main API error:', err),
      });
  }

  loadElementGroupDetails() {
    this.loading = true;
    this.error = '';

    this.documentsService
      .getElementGroupDetails(this.elementGroupId, this.accUserId)
      .subscribe({
        next: (response: any) => {
          this.elementGroupData = response;

          if (response && response.alternativeIdentifiers) {
          } else {
            console.log(
              'ElementGroupDetailsComponent: No alternativeIdentifiers found in response'
            );
          }
          if (
            response &&
            response.distinctPropertyValuesInElementGroupByName &&
            response.distinctPropertyValuesInElementGroupByName.results
          ) {
            this.categories =
              response.distinctPropertyValuesInElementGroupByName.results;
          } else {
            this.categories = [];
          }

          this.loading = false;
          if (
            response &&
            (this.categories.length > 0 || response.alternativeIdentifiers)
          ) {
          }
        },
        error: (error: any) => {
          console.error(
            'ElementGroupDetailsComponent: Error loading element group details:',
            error
          );
          console.error(
            'ElementGroupDetailsComponent: Error details:',
            error.error || error.message
          );
          this.error = 'Failed to load element group details';
          this.loading = false;
        },
      });
  }

  onBackToDocuments() {
    console.log('ElementGroupDetailsComponent: Navigating back to documents');
    this.router.navigate(['/documents']);
  }

  private parseNoDataList(message: string): RuleName[] {
    const lower = (message || '').toLowerCase();
    if (!lower.includes('has no data available')) return [];

    const head = message.split(/has no data available/i)[0] || '';
    const items = head
      .split(/,|and/i)
      .map((s) => s.trim())
      .filter(Boolean);

    const allowed: RuleName[] = ['Rule1', 'Rule2', 'Rule3', 'Rule4', 'Rule5'];
    return items
      .map((it) => allowed.find((a) => a.toLowerCase() === it.toLowerCase()))
      .filter((v): v is RuleName => !!v);
  }

  private apiForRule(rule: RuleName): Observable<any> {
    const ruleNo = rule.replace('Rule', ''); // "Rule4" -> "4"
    const url = `${this.baseUrl}/rule-data/getRuleData${ruleNo}/${this.elementGroupId}?accUserId=${this.accUserId}`;
    return this.http.get(url).pipe(take(1));
  }

  getTotalCount(category: any): number {
    if (!category.values) return 0;
    return category.values.reduce(
      (total: number, item: any) => total + (item.count || 0),
      0
    );
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
    console.log('ElementGroupDetailsComponent: Rule 1 button clicked');
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
    console.log('ElementGroupDetailsComponent: Rule 4 button clicked');
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
    if (!this.viewerContainer) {
      console.error('Viewer container not found');
      return;
    }

    const container = this.viewerContainer.nativeElement;

    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      setTimeout(() => {
        this.initViewer();
      }, 100);
      return;
    }

    this.viewerLoading = true;
    this.viewerError = '';

    const id = this.urn;
    const urn = window.btoa(id).replace(/=/g, '');

    this.viewerService
      .initViewer(container, urn)
      .then((viewer) => {
        this.viewer = viewer;
        this.viewerLoading = false;
      })
      .catch((error) => {
        console.error(
          'ElementGroupDetailsComponent: Error initializing viewer:',
          error
        );
        this.viewerError =
          'Failed to load 3D viewer: ' + (error.message || error);
        this.viewerLoading = false;
      });
  }
  toggleCompact(): void {
    this.compact = !this.compact;
  }
}
