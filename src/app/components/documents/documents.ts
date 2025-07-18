import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '../header/header';
import { SidebarComponent } from '../sidebar/sidebar';
import { DocumentsService, Hub, Project, ElementGroup } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { AuthService } from '../../services/auth.service';
import { UploadModalComponent } from '../upload-modal/upload-modal';

interface TreeNode {
  id: string;
  name: string;
  type: 'hub' | 'project' | 'elementGroup';
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
  parentId?: string; // For tracking parent relationships
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, UploadModalComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.scss'
})
export class DocumentsComponent implements OnInit {
  showEmptyTree = true; // Changed from false to true to show tree by default
  showMobileMenu = false;
  treeData: TreeNode[] = [];
  loading = false;
  accUserId: string = '';
  showUploadModal = false;

  constructor(
    private documentsService: DocumentsService,
    private localService: LocalService,
    private autodeskAuthService: AutodeskAuthService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('DocumentsComponent: ngOnInit called - component loaded!');
    
    // Get accUserId from local storage or other source
    const userData = this.localService.getUserData();
    this.accUserId = userData?.accUserId || '';
    console.log('DocumentsComponent: User data from storage:', userData);
    console.log('DocumentsComponent: accUserId from storage:', this.accUserId);
    
    // If no accUserId in storage, try to get it from Autodesk auth service
    if (!this.accUserId) {
      const authStatus = this.autodeskAuthService.getAuthStatus();
      this.accUserId = authStatus.accUserId || '';
      console.log('DocumentsComponent: accUserId from Autodesk auth service:', this.accUserId);
    }
    
    if (!this.accUserId) {
      console.warn('DocumentsComponent: No accUserId found in any source');
    }
    
    // Debug authentication state
    console.log('DocumentsComponent: Local service isAuthenticated:', this.localService.isAuthenticated());
    console.log('DocumentsComponent: Local service access token:', this.localService.getAccessToken());
    console.log('DocumentsComponent: Auth service isAuthenticated:', this.authService.isAuthenticated());
    console.log('DocumentsComponent: Auth service access token:', this.authService.getAccessToken());
    
    console.log('DocumentsComponent: Component initialization complete');
    
    // Automatically show the tree and load data when component initializes
    // this.showEmptyTree = true; // This line is now redundant as showEmptyTree is initialized to true
    console.log('DocumentsComponent: showEmptyTree set to:', this.showEmptyTree);
    
    // Load tree data after a short delay to ensure component is fully initialized
    setTimeout(() => {
      this.loadTreeData();
    }, 100);
  }

  onDocumentsClick() {
    console.log('DocumentsComponent: Documents clicked, loading tree data...');
    console.log('DocumentsComponent: Current accUserId:', this.accUserId);
    console.log('DocumentsComponent: Auth service isAuthenticated:', this.authService.isAuthenticated());
    console.log('DocumentsComponent: Access token available:', !!this.authService.getAccessToken());
    
    // Force show the tree section
    this.showEmptyTree = true;
    console.log('DocumentsComponent: showEmptyTree set to:', this.showEmptyTree);
    
    // Clear existing tree data to ensure fresh load
    this.treeData = [];
    this.loading = false;
    
    // Add a small delay to ensure the UI updates
    setTimeout(() => {
      this.loadTreeData();
    }, 100);
  }

  onMobileMenuToggle() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  onUploadToACC() {
    console.log('DocumentsComponent: Upload to ACC clicked');
    this.showUploadModal = true;
  }

  onCloseUploadModal() {
    console.log('DocumentsComponent: Upload modal closed');
    this.showUploadModal = false;
  }

  onElementGroupClick(elementGroup: TreeNode) {
    console.log('DocumentsComponent: Element group clicked:', elementGroup);
    if (elementGroup.type === 'elementGroup') {
      // Navigate to element group details page
      const url = `/element-group/${elementGroup.id}/${encodeURIComponent(elementGroup.name)}`;
      console.log('DocumentsComponent: Navigating to:', url);
      this.router.navigate([url]);
    }
  }

  loadTreeData() {
    console.log('DocumentsComponent: loadTreeData called');
    console.log('DocumentsComponent: accUserId:', this.accUserId);
    console.log('DocumentsComponent: Auth service isAuthenticated:', this.authService.isAuthenticated());
    console.log('DocumentsComponent: Access token:', this.authService.getAccessToken());
    
    if (!this.accUserId) {
      console.error('DocumentsComponent: No accUserId available');
      // Still show the tree section even if no accUserId, so user can see the interface
      this.showEmptyTree = true;
      return;
    }

    // Try to refresh authentication state first
    this.authService.refreshAuthState();
    console.log('DocumentsComponent: After refresh - Auth service isAuthenticated:', this.authService.isAuthenticated());
    console.log('DocumentsComponent: After refresh - Access token:', this.authService.getAccessToken());

    // Ensure tree is visible before loading
    this.showEmptyTree = true;
    
    // Proceed with API call even if AuthService says not authenticated, since we have accUserId
    this.loading = true;
    console.log('DocumentsComponent: Loading hubs for accUserId:', this.accUserId);

    this.documentsService.getHubs(this.accUserId).subscribe({
      next: (response) => {
        console.log('DocumentsComponent: Hubs response received:', response);
        
        // Handle the correct response structure
        if (response && response.hubs && response.hubs.results) {
          this.treeData = response.hubs.results.map(hub => {
            console.log('DocumentsComponent: Processing hub:', hub);
            return {
              id: hub.id,
              name: hub.name,
              type: 'hub' as const,
              children: [],
              expanded: false,
              loading: false
            };
          });
          console.log('DocumentsComponent: Tree data initialized:', this.treeData);
        } else {
          console.error('DocumentsComponent: Unexpected response structure:', response);
          this.treeData = [];
        }
        
        // Ensure tree is visible after data is loaded
        this.showEmptyTree = true;
        this.loading = false;
      },
      error: (error) => {
        console.error('DocumentsComponent: Error loading hubs:', error);
        console.error('DocumentsComponent: Error details:', error.error || error.message);
        // Still show the tree section even on error, so user can see the interface
        this.showEmptyTree = true;
        this.loading = false;
      }
    });
  }

  toggleNode(node: TreeNode) {
    console.log('DocumentsComponent: Toggling node:', node);
    
    if (node.type === 'hub' && !node.expanded && node.children!.length === 0) {
      // Load projects for this hub
      this.loadProjects(node);
    } else if (node.type === 'project' && !node.expanded && node.children!.length === 0) {
      // Load element groups for this project
      this.loadElementGroups(node);
    }
    
    node.expanded = !node.expanded;
    console.log('DocumentsComponent: Node expanded state:', node.expanded);
  }

  loadProjects(hubNode: TreeNode) {
    if (!this.accUserId) {
      console.error('DocumentsComponent: No accUserId available for loading projects');
      return;
    }

    hubNode.loading = true;
    console.log('DocumentsComponent: Loading projects for hub:', hubNode.name, 'hubId:', hubNode.id);

    this.documentsService.getProjects(hubNode.id, this.accUserId).subscribe({
      next: (response) => {
        console.log('DocumentsComponent: Projects response received:', response);
        console.log("NAMEEE",response.projects.results[0].name)

        // Save the first project name to LocalService for global access
        if (response.projects.results && response.projects.results.length > 0) {
          const projectName = response.projects.results[0].name;
          this.localService.setProjectName(projectName);
          console.log('DocumentsComponent: Project name saved to LocalService:', projectName);
        }
        
        // Handle the response structure safely
        if (response && response.projects && response.projects.results) {
          hubNode.children = response.projects.results.map(project => {
            console.log('DocumentsComponent: Processing project:', project);
            return {
              id: project.id,
              name: project.name,
              type: 'project' as const,
              children: [],
              expanded: false,
              loading: false,
              parentId: hubNode.id
            };
          });
          
          console.log('DocumentsComponent: Projects loaded for hub:', hubNode.name, 'projects:', hubNode.children);
        } else {
          console.error('DocumentsComponent: Unexpected projects response structure:', response);
          hubNode.children = [];
        }
        
        hubNode.loading = false;
      },
      error: (error) => {
        console.error('DocumentsComponent: Error loading projects:', error);
        console.error('DocumentsComponent: Projects error details:', error.error || error.message);
        hubNode.loading = false;
      }
    });
  }

  loadElementGroups(projectNode: TreeNode) {
    if (!this.accUserId || !projectNode.parentId) {
      console.error('DocumentsComponent: No accUserId or parentId available for loading element groups');
      return;
    }

    projectNode.loading = true;
    console.log('DocumentsComponent: Loading element groups for project:', projectNode.name, 'projectId:', projectNode.id, 'hubId:', projectNode.parentId);

    this.documentsService.getElementGroups(projectNode.parentId, projectNode.id, this.accUserId).subscribe({
      next: (response) => {
        console.log('DocumentsComponent: Element groups response received:', response);
        
        // Handle the response structure safely
        if (response && response.elementGroupsByProject && response.elementGroupsByProject.results) {
          projectNode.children = response.elementGroupsByProject.results.map(elementGroup => {
            console.log('DocumentsComponent: Processing element group:', elementGroup);
            return {
              id: elementGroup.id,
              name: elementGroup.name,
              type: 'elementGroup' as const,
              children: [],
              expanded: false,
              loading: false,
              parentId: projectNode.id
            };
          });
          console.log('DocumentsComponent: Element groups loaded for project:', projectNode.name, 'elementGroups:', projectNode.children);
        } else {
          console.error('DocumentsComponent: Unexpected element groups response structure:', response);
          projectNode.children = [];
        }
        
        projectNode.loading = false;
      },
      error: (error) => {
        console.error('DocumentsComponent: Error loading element groups:', error);
        console.error('DocumentsComponent: Element groups error details:', error.error || error.message);
        projectNode.loading = false;
      }
    });
  }
} 