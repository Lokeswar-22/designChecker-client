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
      schema: {
        href: string;
      };
      data: any;
    };
    region: string;
  };
  links: {
    self: {
      href: string;
    };
  };
  relationships: {
    projects: {
      links: {
        related: {
          href: string;
        };
      };
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
      schema: {
        href: string;
      };
      data: {
        projectType: string;
      };
    };
  };
  links: {
    self: {
      href: string;
    };
    webView: {
      href: string;
    };
  };
  relationships: {
    hub: {
      data: {
        type: string;
        id: string;
      };
      links: {
        related: {
          href: string;
        };
      };
    };
    rootFolder: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
    };
    topFolders: {
      links: {
        related: {
          href: string;
        };
      };
    };
    issues: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
    };
    submittals: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
    };
    rfis: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
    };
    markups: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
    };
    cost: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
    };
    locations: {
      data: {
        type: string;
        id: string;
      };
      meta: {
        link: {
          href: string;
        };
      };
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
      schema: {
        href: string;
      };
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
    self: {
      href: string;
    };
    webView: {
      href: string;
    };
  };
  relationships: {
    contents: {
      links: {
        related: {
          href: string;
        };
      };
    };
    parent: {
      data: {
        type: string;
        id: string;
      };
      links: {
        related: {
          href: string;
        };
      };
    };
    refs: {
      links: {
        self: {
          href: string;
        };
        related: {
          href: string;
        };
      };
    };
    links: {
      links: {
        self: {
          href: string;
        };
      };
    };
  };
}

export interface UploadTopFoldersResponse {
  jsonapi: {
    version: string;
  };
  links: {
    self: {
      href: string;
    };
  };
  data: UploadFolder[];
}

export interface UploadFolderContentsResponse {
  jsonapi: {
    version: string;
  };
  links: {
    self: {
      href: string;
    };
  };
  data: UploadFolder[];
}

export type UploadHubsResponse = UploadHub[];
export type UploadProjectsResponse = UploadProject[];

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private baseUrl = environment.apiBaseUrl;

  constructor(
    private http: HttpClient
  ) {}

  getUploadHubs(accUserId: string): Observable<UploadHubsResponse> {
    console.log('UploadService: Fetching upload hubs for accUserId:', accUserId);
    
    // Make direct API call without authentication headers
    const url = `${this.baseUrl}/hubs/upload?accUserId=${accUserId}`;
    console.log('UploadService: Making API call to:', url);
    
    return this.http.get<UploadHubsResponse>(url);
  }

  getUploadProjects(hubId: string, accUserId: string): Observable<UploadProjectsResponse> {
    console.log('UploadService: Fetching upload projects for hubId:', hubId, 'accUserId:', accUserId);
    
    const url = `${this.baseUrl}/hubs/${hubId}/projects/upload?accUserId=${accUserId}`;
    console.log('UploadService: Making API call to:', url);
    
    return this.http.get<UploadProjectsResponse>(url);
  }

  getUploadTopFolders(hubId: string, projectId: string, accUserId: string): Observable<UploadTopFoldersResponse> {
    console.log('UploadService: Fetching upload top folders for hubId:', hubId, 'projectId:', projectId, 'accUserId:', accUserId);
    
    const url = `${this.baseUrl}/hubs/${hubId}/projects/${projectId}/top-folders?accUserId=${accUserId}`;
    console.log('UploadService: Making API call to:', url);
    
    return this.http.get<UploadTopFoldersResponse>(url);
  }

  getUploadFolderContents(projectId: string, folderId: string, accUserId: string): Observable<UploadFolderContentsResponse> {
    console.log('UploadService: Fetching folder contents for projectId:', projectId, 'folderId:', folderId, 'accUserId:', accUserId);
    
    const url = `${this.baseUrl}/hubs/projects/${projectId}/folders/${folderId}/contents?accUserId=${accUserId}`;
    console.log('UploadService: Making API call to:', url);
    
    return this.http.get<UploadFolderContentsResponse>(url);
  }
} 