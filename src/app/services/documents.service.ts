import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

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
  private baseUrl = 'http://localhost:3005';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getHubs(accUserId: string): Observable<HubsResponse> {
    console.log('DocumentsService: Fetching hubs for accUserId:', accUserId);
    
    // Get the access token
    const accessToken = this.authService.getAccessToken();
    console.log('DocumentsService: Access token available:', !!accessToken);
    console.log('DocumentsService: Access token value:', accessToken);
    console.log('DocumentsService: Auth service isAuthenticated:', this.authService.isAuthenticated());
    
    // The auth interceptor should automatically add the token, but let's also add it explicitly
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    
    console.log('DocumentsService: Making API call to:', `${this.baseUrl}/hubs?accUserId=${accUserId}`);
    console.log('DocumentsService: Headers:', headers);
    
    return this.http.get<HubsResponse>(`${this.baseUrl}/hubs?accUserId=${accUserId}`, { headers });
  }

  getProjects(hubId: string, accUserId: string): Observable<ProjectsResponse> {
    console.log('DocumentsService: Fetching projects for hubId:', hubId, 'accUserId:', accUserId);
    
    // Get the access token
    const accessToken = this.authService.getAccessToken();
    console.log('DocumentsService: Access token available for projects:', !!accessToken);
    
    // The auth interceptor should automatically add the token, but let's also add it explicitly
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<ProjectsResponse>(`${this.baseUrl}/hubs/${hubId}/projects?accUserId=${accUserId}`, { headers });
  }

  getElementGroups(hubId: string, projectId: string, accUserId: string): Observable<ElementGroupsResponse> {
    console.log('DocumentsService: Fetching element groups for hubId:', hubId, 'projectId:', projectId, 'accUserId:', accUserId);
    
    // Get the access token
    const accessToken = this.authService.getAccessToken();
    console.log('DocumentsService: Access token available for element groups:', !!accessToken);
    
    // The auth interceptor should automatically add the token, but let's also add it explicitly
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<ElementGroupsResponse>(`${this.baseUrl}/hubs/projects/${projectId}/element-groups?accUserId=${accUserId}`, { headers });
  }

  getElementGroupDetails(elementGroupId: string, accUserId: string): Observable<any> {
    console.log('DocumentsService: Fetching element group details for elementGroupId:', elementGroupId, 'accUserId:', accUserId);
    
    // Get the access token
    const accessToken = this.authService.getAccessToken();
    console.log('DocumentsService: Access token available for element group details:', !!accessToken);
    
    // The auth interceptor should automatically add the token, but let's also add it explicitly
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    
    const body = {
      elementGroupId: elementGroupId
    };
    
    console.log('DocumentsService: Making POST request to getAvailableCategories with body:', body);
    
    return this.http.post<any>(`${this.baseUrl}/hubs/getAvailableCategories?accUserId=${accUserId}`, body, { headers });
  }

  getElementsByCategory(elementGroupId: string, accUserId: string, propertyFilter: string): Observable<any> {
    console.log('DocumentsService: Fetching elements by category for elementGroupId:', elementGroupId, 'accUserId:', accUserId, 'propertyFilter:', propertyFilter);
    
    // Get the access token
    const accessToken = this.authService.getAccessToken();
    console.log('DocumentsService: Access token available for elements by category:', !!accessToken);
    
    // The auth interceptor should automatically add the token, but let's also add it explicitly
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    });
    
    const body = {
      elementGroupId: elementGroupId,
      propertyFilter: propertyFilter
    };
    
    console.log('DocumentsService: Making POST request to elementsCategory with body:', body);
    
    return this.http.post<any>(`${this.baseUrl}/hubs/elementsCategory?accUserId=${accUserId}`, body, { headers });
  }
} 