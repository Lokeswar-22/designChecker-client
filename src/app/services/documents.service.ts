import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Hub {
  id: string;
  name: string;
  type: string;
}

export interface Project {
  id: string;
  name: string;
  type: string;
}

export interface ElementGroup {
  id: string;
  name: string;
  type: string;
  alternativeIdentifiers?: any;
}

export interface HubsResponse {
  hubs: {
    results: Hub[];
    pagination: {
      cursor: string | null;
    };
  };
}

export interface ProjectsResponse {
  projects: {
    results: Project[];
    pagination: {
      cursor: string | null;
    };
  };
}

export interface ElementGroupsResponse {
  elementGroupsByProject: {
    results: ElementGroup[];
    pagination: {
      cursor: string | null;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private baseUrl = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getHubs(accUserId: string): Observable<HubsResponse> {
    const accessToken = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<HubsResponse>(`${this.baseUrl}/hubs?accUserId=${accUserId}`, { headers });
  }

  getProjects(hubId: string, accUserId: string): Observable<ProjectsResponse> {
    const accessToken = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<ProjectsResponse>(`${this.baseUrl}/hubs/${hubId}/projects?accUserId=${accUserId}`, { headers });
  }

  getElementGroups(hubId: string, projectId: string, accUserId: string): Observable<ElementGroupsResponse> {
    const accessToken = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<ElementGroupsResponse>(`${this.baseUrl}/hubs/projects/${projectId}/element-groups?accUserId=${accUserId}`, { headers });
  }

  getElementGroupDetails(elementGroupId: string, accUserId: string): Observable<any> {
    const accessToken = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    const body = { elementGroupId };
    return this.http.post<any>(`${this.baseUrl}/hubs/getAvailableCategories?accUserId=${accUserId}`, body, { headers });
  }

  getElementsByCategory(elementGroupId: string, accUserId: string, propertyFilter: string): Observable<any> {
    const accessToken = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    const body = { elementGroupId, propertyFilter };
    return this.http.post<any>(`${this.baseUrl}/hubs/elementsCategory?accUserId=${accUserId}`, body, { headers });
  }
}
