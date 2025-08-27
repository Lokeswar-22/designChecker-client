import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RuleCheckRequest {
  elementGroupId: string;
  accUserId: string;
  levelName?: string;
  // category: string;
  // projectId:string
}

export interface RuleResult {
  revitElementId: string;
  ifcGUID: string | null;
  propertyUsed: string | null;
  widthMM: number | null;
  passed: boolean;
  message: string;
}

export interface RuleSummary {
  totalElementsFound: number;
  totalElementsChecked: number;
  totalPassed: number;
  totalFailed: number;
}

export interface RuleCheckResponse {
  rule: string;
  results?: RuleResult[]; // Direct results for Rule 2
  summary?: RuleSummary | any; // Can be either legacy summary or validation summary
  result?: {
    // Nested structure for Rule 1
    results: RuleResult[];
    summary: RuleSummary;
  };
  issuesCreated?: number;
  // New validation properties - matching the actual API response exactly
  validationResults?: any[];
  failureBreakdown?: any;
}

export interface Issue {
  id: string;
  displayId: number;
  title: string;
  description: string;
  status: string;
  containerId: string;
  issueTypeId: string;
  issueSubtypeId: string;
  assignedTo: string;
  assignedToType: string;
  dueDate: string;
  startDate: string;
  openedBy: string;
  openedAt: string;
  closedBy: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted: boolean;
  published: boolean;
  commentCount: number;
  attachmentCount: number;
  permittedStatuses: string[];
  permittedActions: string[];
  permittedAttributes: string[];
}

export interface IssuesResponse {
  pagination: {
    limit: number;
    offset: number;
    totalResults: number;
  };
  results: Issue[];
}

@Injectable({
  providedIn: 'root',
})
export class RuleService {
  private baseUrl = environment.apiBaseUrl;
  public projectID: string = '';
  public accUserID: string = '';

  constructor(private http: HttpClient) {}

  checkRule1(
    elementGroupId: string,
    accUserId: string,
    projectId: string
  ): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;

    console.log('PROJECT ID', this.projectID);
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
    };

    return this.http.post<RuleCheckResponse>(
      `${this.baseUrl}/rule-engine/rule1`,
      requestBody
    );
  }

  checkRule2(
    elementGroupId: string,
    accUserId: string,
    projectId: string
  ): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
      levelName: 'BASEMENT',
    };
    return this.http.post<RuleCheckResponse>(
      `${this.baseUrl}/rule-engine/rule2`,
      requestBody
    );
  }

  checkRule3(
    elementGroupId: string,
    accUserId: string,
    projectId: string,
    levelName: string
  ): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
    };
    return this.http.post<RuleCheckResponse>(
      `${this.baseUrl}/rule-engine/rule3`,
      requestBody
    );
  }

  checkRule4(
    elementGroupId: string,
    accUserId: string,
    projectId: string
  ): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
    };
    return this.http.post<RuleCheckResponse>(
      `${this.baseUrl}/rule-engine/rule4`,
      requestBody
    );
  }

  checkRule5(
    elementGroupId: string,
    accUserId: string,
    projectId: string
  ): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
    };
    return this.http.post<RuleCheckResponse>(
      `${this.baseUrl}/rule-engine/rule5`,
      requestBody
    );
  }

  checkRule6(
    elementGroupId: string,
    accUserId: string,
    projectId: string
  ): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
    };
    return this.http.post<RuleCheckResponse>(
      `${this.baseUrl}/rule-engine/rule6`,
      requestBody
    );
  }

  getProjectById(accUserId: string, projectName: string): Observable<any> {
    return this.http.get(
      `${
        this.baseUrl
      }/hubs/project-id?accUserId=${accUserId}&projectName=${encodeURIComponent(
        projectName
      )}`
    );
  }

  getIssues(): Observable<IssuesResponse> {
    return this.http.get<IssuesResponse>(
      `${this.baseUrl}/hubs/projects/${this.projectID}/issues?accUserId=${this.accUserID}`
    );
  }

  createIssue(
    projectId: string,
    accUserId: string,
    issueData: any
  ): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/hubs/projects/${projectId}/issues?accUserId=${accUserId}`,
      issueData
    );
  }

  isRuleResultEmpty(response: RuleCheckResponse): boolean {
    if (response.results && response.results.length > 0) {
      return false;
    }
    if (
      response.result &&
      response.result.results &&
      response.result.results.length > 0
    ) {
      return false;
    }
    return true;
  }
}
