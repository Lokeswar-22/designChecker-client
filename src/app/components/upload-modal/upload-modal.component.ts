import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadService } from '../../services/upload.service';
import { LocalService } from '../../services/local.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface UploadTreeNode {
  id: string;
  name: string;
  type: 'uploadHub' | 'uploadProject' | 'uploadFolder';
  children?: UploadTreeNode[];
  expanded?: boolean;
  loading?: boolean;
  parentId?: string;
  hubId?: string;
  projectId?: string;
  folderId?: string;
  subfolderId?: string;
}

@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-modal.component.html',
  styleUrl: './upload-modal.component.scss'
})
export class UploadModalComponent implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();

  treeData: UploadTreeNode[] = [];
  loading = false;
  accUserId: string = '';
  selectedFile: File | null = null;
  uploading = false;
  uploadProgress = 0;

  constructor(
    private uploadService: UploadService,
    private localService: LocalService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const userData = this.localService.getUserData();
    this.accUserId = userData?.accUserId || '';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible']?.currentValue === true) {
      this.loadUploadData();
    }
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  loadUploadData() {
    if (!this.accUserId) return;

    this.loading = true;
    this.uploadService.getUploadHubs(this.accUserId).subscribe({
      next: (response) => {
        if (Array.isArray(response)) {
          this.treeData = response.map(hub => ({
            id: hub.id,
            name: hub.attributes.name,
            type: 'uploadHub' as const,
            children: [],
            expanded: false,
            loading: false,
            hubId: hub.id
          }));
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  toggleNode(node: UploadTreeNode) {
    if (node.type === 'uploadHub') {
      if (!node.expanded && (!node.children || node.children.length === 0)) {
        this.loadProjectsForHub(node);
      }
    } else if (node.type === 'uploadProject') {
      if (!node.expanded && (!node.children || node.children.length === 0)) {
        this.loadFoldersForProject(node);
      }
    } else if (node.type === 'uploadFolder') {
      if (!node.expanded && (!node.children || node.children.length === 0)) {
        if (node.projectId && !node.folderId) {
          this.loadFoldersForProject(node);
        } else {
          this.loadSubfoldersForFolder(node);
        }
      }
    }
    node.expanded = !node.expanded;
  }

  loadProjectsForHub(hubNode: UploadTreeNode) {
    hubNode.loading = true;
    this.uploadService.getUploadProjects(hubNode.id, this.accUserId).subscribe({
      next: (response) => {
        if (Array.isArray(response)) {
          hubNode.children = response.map(project => ({
            id: project.id,
            name: project.attributes.name,
            type: 'uploadProject' as const,
            children: [],
            expanded: false,
            loading: false,
            parentId: hubNode.id,
            hubId: hubNode.id,
            projectId: project.id
          }));
        }
        hubNode.loading = false;
      },
      error: () => {
        hubNode.loading = false;
        hubNode.children = [];
      }
    });
  }

  loadFoldersForProject(projectNode: UploadTreeNode) {
    projectNode.loading = true;
    this.uploadService.getUploadTopFolders(projectNode.hubId!, projectNode.id, this.accUserId).subscribe({
      next: (response) => {
        if (response?.data && Array.isArray(response.data)) {
          projectNode.children = response.data
            .filter(folder => folder.type === 'folders')
            .map(folder => ({
              id: folder.id,
              name: folder.attributes.displayName,
              type: 'uploadFolder' as const,
              children: [],
              expanded: false,
              loading: false,
              parentId: projectNode.id,
              hubId: projectNode.hubId,
              projectId: projectNode.id,
              folderId: folder.id
            }));
        }
        projectNode.loading = false;
      },
      error: () => {
        projectNode.loading = false;
        projectNode.children = [];
      }
    });
  }

  loadSubfoldersForFolder(folderNode: UploadTreeNode) {
    folderNode.loading = true;
    this.uploadService.getUploadFolderContents(folderNode.projectId!, folderNode.folderId!, this.accUserId).subscribe({
      next: (response: any) => {
        const dataArray = response?.data && Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
        if (dataArray.length > 0) {
          folderNode.children = dataArray
            .filter((item: any) => item.type === 'folders')
            .map((subfolder: any) => ({
              id: subfolder.id,
              name: subfolder.attributes.name,
              type: 'uploadFolder' as const,
              children: [],
              expanded: false,
              loading: false,
              parentId: folderNode.id,
              hubId: folderNode.hubId,
              projectId: folderNode.projectId,
              folderId: folderNode.folderId,
              subfolderId: subfolder.id
            }));
        }
        folderNode.loading = false;
      },
      error: () => {
        folderNode.loading = false;
        folderNode.children = [];
      }
    });
  }

  onUploadButtonClick(node: UploadTreeNode) {
    if (node.type === 'uploadFolder') {
      this.triggerFileInput(node);
    }
  }

  triggerFileInput(node: UploadTreeNode) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.rvt';
    fileInput.style.display = 'none';
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        this.uploadFile(node);
      }
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  }

  uploadFile(node: UploadTreeNode) {
    if (!this.selectedFile || !this.accUserId) return;

    this.uploading = true;
    this.uploadProgress = 0;

    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.random() * 10;
      }
    }, 200);

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('userId', this.accUserId);
    formData.append('projectId', node.projectId || '');
    formData.append('hubId', node.hubId || '');
    formData.append('folderId', node.subfolderId || node.folderId || '');

    this.http.post(environment.uploadEndpoints.upload, formData).subscribe({
      next: () => {
        clearInterval(progressInterval);
        this.uploading = false;
        this.uploadProgress = 100;
        alert(`File "${this.selectedFile?.name}" uploaded successfully to "${node.name}"`);
        this.selectedFile = null;
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.uploading = false;
        this.uploadProgress = 0;
        this.selectedFile = null;
        alert(error.error?.message || error.message || 'Upload failed');
      }
    });
  }
}

