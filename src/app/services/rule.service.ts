import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RuleCheckRequest {
  elementGroupId: string;
  accUserId: string;
  category: string;
  projectId:string
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
  summary?: RuleSummary; // Direct summary for Rule 2
  result?: { // Nested structure for Rule 1
    results: RuleResult[];
    summary: RuleSummary;
  };
  issuesCreated?: number;
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
  providedIn: 'root'
})
export class RuleService {
  private baseUrl = 'http://localhost:3005';
  public projectID: string = '';
  public accUserID: string = '';

  constructor(private http: HttpClient) {}

  checkRule1(elementGroupId: string, accUserId: string, projectId: string): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;

    console.log("PROJECT ID",this.projectID)
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
      projectId,
      category: 'property.name.category==Doors'
    };

    return this.http.post<RuleCheckResponse>(`${this.baseUrl}/rule-check/rule1`, requestBody);
  }

  checkRule2(elementGroupId: string, accUserId: string, projectId: string): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
      projectId,
      category: 'property.name.category==Ramps'
    };
    return this.http.post<RuleCheckResponse>(`${this.baseUrl}/rule-check/rule2`, requestBody);
  }

  checkRule3(elementGroupId: string, accUserId: string, projectId: string): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
      projectId,
      category: 'property.name.category==Ramps'
    };
    return this.http.post<RuleCheckResponse>(`${this.baseUrl}/rule-check/rule3`, requestBody);
  }

  checkRule4(elementGroupId: string, accUserId: string, projectId: string): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
      projectId,
      category: 'property.name.category==Stairs'
    };
    return this.http.post<RuleCheckResponse>(`${this.baseUrl}/rule-check/rule4`, requestBody);
  }

  checkRule5(elementGroupId: string, accUserId: string, projectId: string): Observable<RuleCheckResponse> {
    this.projectID = projectId;
    this.accUserID = accUserId;
    const requestBody: RuleCheckRequest = {
      elementGroupId,
      accUserId,
      projectId,
      category: 'property.name.category==Walls'
    };
    return this.http.post<RuleCheckResponse>(`${this.baseUrl}/rule-check/rule5`, requestBody);
  }

  getProjectById(accUserId: string, projectName: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/hubs/project-id?accUserId=${accUserId}&projectName=${encodeURIComponent(projectName)}`);
  }

  getIssues(): Observable<IssuesResponse> {
    return this.http.get<IssuesResponse>(`${this.baseUrl}/hubs/projects/${this.projectID}/issues?accUserId=${this.accUserID}`);
  }

  createIssue(projectId: string, accUserId: string, issueData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/hubs/projects/${projectId}/issues?accUserId=${accUserId}`, issueData);
  }
} 