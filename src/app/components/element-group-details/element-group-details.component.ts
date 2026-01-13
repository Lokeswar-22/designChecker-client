import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { DocumentsService } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { ViewerService } from '../../services/viewer.service';
import { AccIssuesModalComponent } from '../acc-issues-modal/acc-issues-modal.component';
import { ElementsModalComponent } from '../elements-modal/elements-modal.component';
import { HeaderComponent } from '../header/header.component';
import { RuleModalComponent } from '../rule-modal/rule-modal.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-element-group-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    SidebarComponent,
    ElementsModalComponent,
    RuleModalComponent,
    AccIssuesModalComponent,
  ],
  templateUrl: './element-group-details.component.html',
  styleUrl: './element-group-details.component.scss',
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
  showAiToolModal = false;
  aiPromptMessage = '';
  aiResponseMessage = '';
  aiLoading = false;
  aiError = '';
  currentUserName = '';
  private aiApiUrl = 'http://127.0.0.1:3001/api/ai/respond';

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

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.elementGroupId = params['elementGroupId'];
      this.elementGroupName = params['elementGroupName'];
    });

    this.route.queryParams.subscribe((queryParams) => {
      if (queryParams['alternativeIdentifiers']) {
        try {
          const alternativeIdentifiers = JSON.parse(
            decodeURIComponent(queryParams['alternativeIdentifiers'])
          );
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

    // Get current user name for AI Tool
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      if (currentUser.firstName && currentUser.lastName) {
        this.currentUserName = `${currentUser.firstName} ${currentUser.lastName}`;
      } else if (currentUser.name) {
        this.currentUserName = currentUser.name;
      } else if (currentUser.username) {
        this.currentUserName = currentUser.username;
      } else if (currentUser.email) {
        this.currentUserName = currentUser.email.split('@')[0];
      } else {
        this.currentUserName = 'User';
      }
    } else {
      const localUserData = this.localService.getUserData();
      if (localUserData) {
        if (localUserData.firstName && localUserData.lastName) {
          this.currentUserName = `${localUserData.firstName} ${localUserData.lastName}`;
        } else if (localUserData.name) {
          this.currentUserName = localUserData.name;
        } else if (localUserData.username) {
          this.currentUserName = localUserData.username;
        } else {
          this.currentUserName = 'User';
        }
      } else {
        this.currentUserName = 'User';
      }
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

    this.documentsService
      .getElementGroupDetails(this.elementGroupId, this.accUserId)
      .subscribe({
        next: (response: any) => {
          this.elementGroupData = response;
          if (response?.distinctPropertyValuesInElementGroupByName?.results) {
            this.categories =
              response.distinctPropertyValuesInElementGroupByName.results;
          } else {
            this.categories = [];
          }
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load element group details';
          this.loading = false;
        },
      });
  }

  onBackToDocuments() {
    this.router.navigate(['/documents']);
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

  openAiToolModal() {
    this.showAiToolModal = true;
    this.aiPromptMessage = '';
    this.aiResponseMessage = '';
    this.aiLoading = false;
    this.aiError = '';
  }

  closeAiToolModal() {
    this.showAiToolModal = false;
    this.aiPromptMessage = '';
    this.aiResponseMessage = '';
    this.aiLoading = false;
    this.aiError = '';
  }

  async onAiPromptSubmit() {
    if (!this.aiPromptMessage.trim() || this.aiLoading) {
      return;
    }

    this.aiLoading = true;
    this.aiError = '';
    this.aiResponseMessage = '';

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const body = {
      prompt: this.aiPromptMessage.trim(),
    };

    try {
      const response = await this.http
        .post<any>(this.aiApiUrl, body, { headers })
        .toPromise();

      if (!response) {
        throw new Error('Empty response from AI service');
      }

      // Handle text response
      if (response.text) {
        this.aiResponseMessage = response.text;
      }

      // Check if response contains DSL JSON
      let dsl: any = null;

      console.log('AI Response received:', response);

      // Case 1: DSL is in response.dsl property
      if (response.dsl) {
        dsl = response.dsl;
        console.log('DSL found in response.dsl:', dsl);
      }
      // Case 2: DSL might be embedded in response.text (possibly in markdown code block)
      else if (response.text) {
        let textToParse = response.text.trim();
        console.log(
          'Checking response.text for DSL, length:',
          textToParse.length
        );

        // Extract JSON from markdown code blocks (```json ... ``` or ``` ... ```)
        // More robust regex to handle various code block formats
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
        const match = textToParse.match(codeBlockRegex);
        if (match && match[1]) {
          textToParse = match[1].trim();
          console.log(
            'Extracted JSON from code block, length:',
            textToParse.length
          );
        }

        // Try to parse as JSON
        try {
          const parsed = JSON.parse(textToParse);
          console.log('Parsed JSON successfully:', parsed);
          // Check if parsed object looks like a DSL (has steps array)
          if (parsed && Array.isArray(parsed.steps)) {
            dsl = parsed;
            console.log('✅ DSL extracted from AI response:', dsl);
          } else {
            console.log(
              '⚠️ Parsed JSON does not have steps array, not a valid DSL'
            );
            console.log('Parsed object keys:', Object.keys(parsed));
          }
        } catch (e) {
          // Not JSON, continue with text response
          console.log('❌ Failed to parse as JSON:', e);
          console.log(
            'Text content (first 500 chars):',
            textToParse.substring(0, 500)
          );
        }
      }
      // Case 3: Check if response itself is a DSL
      else if (response.steps && Array.isArray(response.steps)) {
        dsl = response;
        console.log('DSL found directly in response:', dsl);
      }

      this.aiLoading = false;
    } catch (error: any) {
      this.aiLoading = false;
      this.aiError =
        error.error?.message ||
        error.message ||
        'Failed to get response from AI service';
      console.error('AI API Error:', error);
    }
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

    const urn = window
      .btoa(this.urn)
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    this.viewerService
      .initViewer(container, urn)
      .then((viewer) => {
        this.viewer = viewer;
        this.viewerLoading = false;
      })
      .catch((error) => {
        this.viewerError =
          'Failed to load 3D viewer: ' + (error.message || error);
        this.viewerLoading = false;
      });
  }
}
