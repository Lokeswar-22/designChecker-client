import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { DocumentsService } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { HeaderComponent } from '../header/header';
import { SidebarComponent } from '../sidebar/sidebar';
import { UploadModalComponent } from '../upload-modal/upload-modal';

interface TreeNode {
  id: string;
  name: string;
  type: 'hub' | 'project' | 'elementGroup';
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
  parentId?: string; // For tracking parent relationships
  alternativeIdentifiers?: any; // For element groups
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    UploadModalComponent,
  ],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
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

    const userData = this.localService.getUserData();
    this.accUserId = userData?.accUserId || '';

    if (!this.accUserId) {
      const authStatus = this.autodeskAuthService.getAuthStatus();
      this.accUserId = authStatus.accUserId || '';
    }

    setTimeout(() => {
      this.loadTreeData();
    }, 100);
  }

  onDocumentsClick() {
    this.showEmptyTree = true;

    this.treeData = [];
    this.loading = false;

    setTimeout(() => {
      this.loadTreeData();
    }, 100);
  }

  onMobileMenuToggle() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  onUploadToACC() {
    this.showUploadModal = true;
  }

  onCloseUploadModal() {
    this.showUploadModal = false;
  }

  onElementGroupClick(elementGroup: TreeNode) {
    this.router.navigate(
      ['/element-group', elementGroup.id, elementGroup.name],
      {
        queryParams: {
          alternativeIdentifiers: JSON.stringify(
            elementGroup.alternativeIdentifiers
          ),
        },
      }
    );
  }

  loadTreeData() {
    if (!this.accUserId) {
      this.showEmptyTree = true;
      return;
    }

    this.authService.refreshAuthState();
    this.showEmptyTree = true;

    this.loading = true;

    this.documentsService.getHubs(this.accUserId).subscribe({
      next: (response) => {
        if (response && response.hubs && response.hubs.results) {
          this.treeData = response.hubs.results.map((hub) => {
            return {
              id: hub.id,
              name: hub.name,
              type: 'hub' as const,
              children: [],
              expanded: false,
              loading: false,
            };
          });
        } else {
          this.treeData = [];
        }
        this.showEmptyTree = true;
        this.loading = false;
      },
      error: (error) => {
        this.showEmptyTree = true;
        this.loading = false;
      },
    });
  }

  toggleNode(node: TreeNode) {
    if (node.type === 'hub' && !node.expanded && node.children!.length === 0) {
      this.loadProjects(node);
    } else if (
      node.type === 'project' &&
      !node.expanded &&
      node.children!.length === 0
    ) {
      this.loadElementGroups(node);
    }

    node.expanded = !node.expanded;
  }

  loadProjects(hubNode: TreeNode) {
    if (!this.accUserId) {
      return;
    }

    hubNode.loading = true;

    this.documentsService.getProjects(hubNode.id, this.accUserId).subscribe({
      next: (response) => {
        // Save the first project name to LocalService for global access
        if (response.projects.results && response.projects.results.length > 0) {
          const projectName = response.projects.results[0].name;
          this.localService.setProjectName(projectName);
        }

        if (response && response.projects && response.projects.results) {
          hubNode.children = response.projects.results.map((project) => {
            return {
              id: project.id,
              name: project.name,
              type: 'project' as const,
              children: [],
              expanded: false,
              loading: false,
              parentId: hubNode.id,
            };
          });
        } else {
          hubNode.children = [];
        }

        hubNode.loading = false;
      },
      error: (error) => {
        hubNode.loading = false;
      },
    });
  }

  loadElementGroups(projectNode: TreeNode) {
    if (!this.accUserId || !projectNode.parentId) {
      return;
    }

    projectNode.loading = true;

    this.documentsService
      .getElementGroups(projectNode.parentId, projectNode.id, this.accUserId)
      .subscribe({
        next: (response) => {
          if (
            response &&
            response.elementGroupsByProject &&
            response.elementGroupsByProject.results
          ) {
            projectNode.children = response.elementGroupsByProject.results.map(
              (elementGroup) => {
                return {
                  id: elementGroup.id,
                  name: elementGroup.name,
                  type: 'elementGroup' as const,
                  children: [],
                  expanded: false,
                  loading: false,
                  parentId: projectNode.id,
                  alternativeIdentifiers: elementGroup.alternativeIdentifiers,
                };
              }
            );
          } else {
            projectNode.children = [];
          }

          projectNode.loading = false;
        },
        error: (error) => {
          projectNode.loading = false;
        },
      });
  }
}
