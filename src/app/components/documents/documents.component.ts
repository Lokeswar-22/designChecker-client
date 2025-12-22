import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { DocumentsService } from '../../services/documents.service';
import { LocalService } from '../../services/local.service';
import { AutodeskAuthService } from '../../services/autodesk-auth.service';
import { AuthService } from '../../services/auth.service';
import { UploadModalComponent } from '../upload-modal/upload-modal.component';

interface TreeNode {
  id: string;
  name: string;
  type: 'hub' | 'project' | 'elementGroup';
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
  parentId?: string;
  alternativeIdentifiers?: any;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, UploadModalComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss'
})
export class DocumentsComponent implements OnInit {
  showEmptyTree = true;
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
    this.router.navigate(['/element-group', elementGroup.id, elementGroup.name], {
      queryParams: {
        alternativeIdentifiers: JSON.stringify(elementGroup.alternativeIdentifiers)
      }
    });
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
        if (response?.hubs?.results) {
          this.treeData = response.hubs.results.map(hub => ({
            id: hub.id,
            name: hub.name,
            type: 'hub' as const,
            children: [],
            expanded: false,
            loading: false
          }));
        } else {
          this.treeData = [];
        }
        this.showEmptyTree = true;
        this.loading = false;
      },
      error: () => {
        this.showEmptyTree = true;
        this.loading = false;
      }
    });
  }

  toggleNode(node: TreeNode) {
    if (node.type === 'hub' && !node.expanded && node.children!.length === 0) {
      this.loadProjects(node);
    } else if (node.type === 'project' && !node.expanded && node.children!.length === 0) {
      this.loadElementGroups(node);
    }
    node.expanded = !node.expanded;
  }

  loadProjects(hubNode: TreeNode) {
    if (!this.accUserId) return;

    hubNode.loading = true;
    this.documentsService.getProjects(hubNode.id, this.accUserId).subscribe({
      next: (response) => {
        if (response?.projects?.results) {
          if (response.projects.results.length > 0) {
            this.localService.setProjectName(response.projects.results[0].name);
          }
          hubNode.children = response.projects.results.map(project => ({
            id: project.id,
            name: project.name,
            type: 'project' as const,
            children: [],
            expanded: false,
            loading: false,
            parentId: hubNode.id
          }));
        } else {
          hubNode.children = [];
        }
        hubNode.loading = false;
      },
      error: () => {
        hubNode.loading = false;
      }
    });
  }

  loadElementGroups(projectNode: TreeNode) {
    if (!this.accUserId || !projectNode.parentId) return;

    projectNode.loading = true;
    this.documentsService.getElementGroups(projectNode.parentId, projectNode.id, this.accUserId).subscribe({
      next: (response) => {
        if (response?.elementGroupsByProject?.results) {
          projectNode.children = response.elementGroupsByProject.results.map(elementGroup => ({
            id: elementGroup.id,
            name: elementGroup.name,
            type: 'elementGroup' as const,
            children: [],
            expanded: false,
            loading: false,
            parentId: projectNode.id,
            alternativeIdentifiers: elementGroup.alternativeIdentifiers
          }));
        } else {
          projectNode.children = [];
        }
        projectNode.loading = false;
      },
      error: () => {
        projectNode.loading = false;
      }
    });
  }
}

