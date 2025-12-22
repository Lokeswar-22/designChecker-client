import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UploadHub {
  type: string;
  id: string;
  attributes: {
    name: string;
    extension: {
      type: string;
      version: string;
      schema: { href: string; };
      data: any;
    };
    region: string;
  };
  links: { self: { href: string; }; };
  relationships: {
    projects: {
      links: { related: { href: string; }; };
    };
  };
}

export interface UploadProject {
  type: string;
  id: string;
  attributes: {
    name: string;
    scopes: string[];
    extension: {
      type: string;
      version: string;
      schema: { href: string; };
      data: { projectType: string; };
    };
  };
  links: {
    self: { href: string; };
    webView: { href: string; };
  };
  relationships: {
    hub: {
      data: { type: string; id: string; };
      links: { related: { href: string; }; };
    };
    rootFolder: {
      data: { type: string; id: string; };
      meta: { link: { href: string; }; };
    };
    topFolders: {
      links: { related: { href: string; }; };
    };
  };
}

export interface UploadFolder {
  type: string;
  id: string;
  attributes: {
    name: string;
    displayName: string;
    createTime: string;
    createUserId: string;
    createUserName: string;
    lastModifiedTime: string;
    lastModifiedUserId: string;
    lastModifiedUserName: string;
    lastModifiedTimeRollup: string;
    objectCount: number;
    hidden: boolean;
    extension: {
      type: string;
      version: string;
      schema: { href: string; };
      data: {
        visibleTypes: string[];
        actions: string[];
        allowedTypes: string[];
        isRoot: boolean;
        folderType: string;
        namingStandardIds: string[];
      };
    };
  };
  links: {
    self: { href: string; };
    webView: { href: string; };
  };
  relationships: {
    contents: {
      links: { related: { href: string; }; };
    };
    parent: {
      data: { type: string; id: string; };
      links: { related: { href: string; }; };
    };
  };
}

export interface UploadTopFoldersResponse {
  jsonapi: { version: string; };
  links: { self: { href: string; }; };
  data: UploadFolder[];
}

export interface UploadFolderContentsResponse {
  jsonapi: { version: string; };
  links: { self: { href: string; }; };
  data: UploadFolder[];
}

export type UploadHubsResponse = UploadHub[];
export type UploadProjectsResponse = UploadProject[];

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getUploadHubs(accUserId: string): Observable<UploadHubsResponse> {
    return this.http.get<UploadHubsResponse>(`${this.baseUrl}/hubs/upload?accUserId=${accUserId}`);
  }

  getUploadProjects(hubId: string, accUserId: string): Observable<UploadProjectsResponse> {
    return this.http.get<UploadProjectsResponse>(`${this.baseUrl}/hubs/${hubId}/projects/upload?accUserId=${accUserId}`);
  }

  getUploadTopFolders(hubId: string, projectId: string, accUserId: string): Observable<UploadTopFoldersResponse> {
    return this.http.get<UploadTopFoldersResponse>(`${this.baseUrl}/hubs/${hubId}/projects/${projectId}/top-folders?accUserId=${accUserId}`);
  }

  getUploadFolderContents(projectId: string, folderId: string, accUserId: string): Observable<UploadFolderContentsResponse> {
    return this.http.get<UploadFolderContentsResponse>(`${this.baseUrl}/hubs/projects/${projectId}/folders/${folderId}/contents?accUserId=${accUserId}`);
  }
}
