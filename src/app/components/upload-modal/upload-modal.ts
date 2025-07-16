import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploadService, UploadHub, UploadProject, UploadFolder } from '../../services/upload.service';
import { LocalService } from '../../services/local.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';

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
  subSubfolderId?: string;
}

@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-modal.html',
  styleUrl: './upload-modal.scss'
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
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    console.log('UploadModalComponent: ngOnInit called');
    
    // Get accUserId from local storage or other source
    const userData = this.localService.getUserData();
    this.accUserId = userData?.accUserId || '';
    console.log('UploadModalComponent: accUserId from storage:', this.accUserId);
    
    // If no accUserId in storage, try to get it from Autodesk auth service
    if (!this.accUserId) {
      console.warn('UploadModalComponent: No accUserId found in any source');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('UploadModalComponent: ngOnChanges called', changes);
    
    // Check if isVisible changed to true
    if (changes['isVisible'] && changes['isVisible'].currentValue === true) {
      console.log('UploadModalComponent: Modal became visible, loading data...');
      this.loadUploadData();
    }
  }

  onOpen() {
    console.log('UploadModalComponent: Modal opened, loading upload data...');
    this.loadUploadData();
  }

  onClose() {
    console.log('UploadModalComponent: Modal closed');
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  loadUploadData() {
    console.log('UploadModalComponent: loadUploadData called');
    console.log('UploadModalComponent: accUserId:', this.accUserId);
    
    if (!this.accUserId) {
      console.error('UploadModalComponent: No accUserId available');
      return;
    }

    this.loading = true;
    console.log('UploadModalComponent: Loading upload hubs for accUserId:', this.accUserId);

    this.uploadService.getUploadHubs(this.accUserId).subscribe({
      next: (response) => {
        console.log('UploadModalComponent: Upload hubs response received:', response);
        
        if (response && Array.isArray(response)) {
          this.treeData = response.map(hub => {
            console.log('UploadModalComponent: Processing upload hub:', hub);
            console.log('UploadModalComponent: Hub ID:', hub.id);
            console.log('UploadModalComponent: Hub name:', hub.attributes.name);
            return {
              id: hub.id,
              name: hub.attributes.name,
              type: 'uploadHub' as const,
              children: [],
              expanded: false,
              loading: false,
              hubId: hub.id
            };
          });
          console.log('UploadModalComponent: Upload tree data initialized:', this.treeData);
        } else {
          console.error('UploadModalComponent: Unexpected response structure:', response);
          this.treeData = [];
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('UploadModalComponent: Error loading upload hubs:', error);
        console.error('UploadModalComponent: Error details:', error.error || error.message);
        this.loading = false;
      }
    });
  }

  toggleNode(node: UploadTreeNode) {
    console.log('UploadModalComponent: Toggling node:', node);
    
    if (node.type === 'uploadHub') {
      // Console log the stored hub ID
      console.log('UploadModalComponent: Hub clicked - Hub ID:', node.id);
      console.log('UploadModalComponent: Hub clicked - Hub name:', node.name);
      
      // If hub is being expanded and has no children yet, load projects
      if (!node.expanded && (!node.children || node.children.length === 0)) {
        this.loadProjectsForHub(node);
      }
    } else if (node.type === 'uploadProject') {
      // Console log the stored project ID
      console.log('UploadModalComponent: Project clicked - Project ID:', node.id);
      console.log('UploadModalComponent: Project clicked - Project name:', node.name);
      console.log('UploadModalComponent: Project clicked - Hub ID:', node.hubId);
      
      // If project is being expanded and has no children yet, load folders
      if (!node.expanded && (!node.children || node.children.length === 0)) {
        this.loadFoldersForProject(node);
      }
    } else if (node.type === 'uploadFolder') {
      // Console log the stored folder ID
      console.log('UploadModalComponent: Folder clicked - Folder ID:', node.id);
      console.log('UploadModalComponent: Folder clicked - Folder name:', node.name);
      console.log('UploadModalComponent: Folder clicked - Project ID:', node.projectId);
      
      // If folder is being expanded and has no children yet, load subfolders
      if (!node.expanded && (!node.children || node.children.length === 0)) {
        // Check if this is a top-level folder (has projectId but no folderId)
        if (node.projectId && !node.folderId) {
          this.loadFoldersForProject(node);
        } else {
          // This is a subfolder, load its contents
          this.loadSubfoldersForFolder(node);
        }
      }
    }
    
    node.expanded = !node.expanded;
    console.log('UploadModalComponent: Node expanded state:', node.expanded);
  }

  loadProjectsForHub(hubNode: UploadTreeNode) {
    console.log('UploadModalComponent: Loading projects for hub:', hubNode.id);
    console.log('UploadModalComponent: Hub ID being used:', hubNode.id);
    console.log('UploadModalComponent: accUserId being used:', this.accUserId);
    
    hubNode.loading = true;
    
    this.uploadService.getUploadProjects(hubNode.id, this.accUserId).subscribe({
      next: (response) => {
        console.log('UploadModalComponent: Upload projects response received:', response);
        
        if (response && Array.isArray(response)) {
          const projectNodes = response.map(project => {
            console.log('UploadModalComponent: Processing upload project:', project);
            console.log('UploadModalComponent: Project ID:', project.id);
            console.log('UploadModalComponent: Project name:', project.attributes.name);
            
            // Store and console log the project ID
            console.log('UploadModalComponent: Stored project ID:', project.id);
            
            return {
              id: project.id,
              name: project.attributes.name,
              type: 'uploadProject' as const,
              children: [],
              expanded: false,
              loading: false,
              parentId: hubNode.id,
              hubId: hubNode.id,
              projectId: project.id
            };
          });
          
          hubNode.children = projectNodes;
          console.log('UploadModalComponent: Projects loaded for hub:', hubNode.id, 'Projects:', projectNodes);
        } else {
          console.error('UploadModalComponent: Unexpected projects response structure:', response);
          hubNode.children = [];
        }
        
        hubNode.loading = false;
      },
      error: (error) => {
        console.error('UploadModalComponent: Error loading upload projects:', error);
        console.error('UploadModalComponent: Error details:', error.error || error.message);
        hubNode.loading = false;
        hubNode.children = [];
      }
    });
  }

  loadFoldersForProject(projectNode: UploadTreeNode) {
    console.log('UploadModalComponent: Loading folders for project:', projectNode.id);
    console.log('UploadModalComponent: Hub ID being used:', projectNode.hubId);
    console.log('UploadModalComponent: Project ID being used:', projectNode.id);
    console.log('UploadModalComponent: accUserId being used:', this.accUserId);
    
    projectNode.loading = true;
    
    this.uploadService.getUploadTopFolders(projectNode.hubId!, projectNode.id, this.accUserId).subscribe({
      next: (response) => {
        console.log('UploadModalComponent: Upload top folders response received:', response);
        
        if (response && response.data && Array.isArray(response.data)) {
          const folderNodes = response.data
            .filter(folder => folder.type === 'folders')
            .map(folder => {
              console.log('UploadModalComponent: Processing upload folder:', folder);
              console.log('UploadModalComponent: Folder ID:', folder.id);
              console.log('UploadModalComponent: Folder display name:', folder.attributes.displayName);
              
              // Store and console log the folder ID
              console.log('UploadModalComponent: Stored folder ID:', folder.id);
              
              return {
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
              };
            });
          
          projectNode.children = folderNodes;
          console.log('UploadModalComponent: Folders loaded for project:', projectNode.id, 'Folders:', folderNodes);
        } else {
          console.error('UploadModalComponent: Unexpected folders response structure:', response);
          projectNode.children = [];
        }
        
        projectNode.loading = false;
      },
      error: (error) => {
        console.error('UploadModalComponent: Error loading upload folders:', error);
        console.error('UploadModalComponent: Error details:', error.error || error.message);
        projectNode.loading = false;
        projectNode.children = [];
      }
    });
  }

  loadSubfoldersForFolder(folderNode: UploadTreeNode) {
    console.log('UploadModalComponent: Loading subfolders for folder:', folderNode.id);
    console.log('UploadModalComponent: Hub ID being used:', folderNode.hubId);
    console.log('UploadModalComponent: Project ID being used:', folderNode.projectId);
    console.log('UploadModalComponent: Folder ID being used:', folderNode.folderId);
    console.log('UploadModalComponent: accUserId being used:', this.accUserId);
    
    folderNode.loading = true;
    
    this.uploadService.getUploadFolderContents(folderNode.projectId!, folderNode.folderId!, this.accUserId).subscribe({
      next: (response: any) => {
        console.log('UploadModalComponent: Upload folder contents response received:', response);
        
        // Handle both array response and wrapped response
        let dataArray = response;
        if (response && response.data && Array.isArray(response.data)) {
          dataArray = response.data;
        } else if (!Array.isArray(response)) {
          console.error('UploadModalComponent: Unexpected folder contents response structure:', response);
          folderNode.children = [];
          folderNode.loading = false;
          return;
        }
        
        if (dataArray && Array.isArray(dataArray)) {
          const subfolderNodes = dataArray
            .filter((item: any) => item.type === 'folders')
            .map((subfolder: any) => {
              console.log('UploadModalComponent: Processing upload subfolder:', subfolder);
              console.log('UploadModalComponent: Subfolder ID:', subfolder.id);
              console.log('UploadModalComponent: Subfolder name:', subfolder.attributes.name);
              
              // Store and console log the subfolder ID
              console.log('UploadModalComponent: Stored subfolder ID:', subfolder.id);
              
              return {
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
              };
            });
          
          folderNode.children = subfolderNodes;
          console.log('UploadModalComponent: Subfolders loaded for folder:', folderNode.id, 'Subfolders:', subfolderNodes);
        } else {
          console.error('UploadModalComponent: Unexpected folder contents response structure:', response);
          folderNode.children = [];
        }
        
        folderNode.loading = false;
      },
      error: (error: any) => {
        console.error('UploadModalComponent: Error loading upload folder contents:', error);
        console.error('UploadModalComponent: Error details:', error.error || error.message);
        folderNode.loading = false;
        folderNode.children = [];
      }
    });
  }

  onUploadButtonClick(node: UploadTreeNode) {
    if (node.type === 'uploadFolder') {
      console.log('UploadModalComponent: Upload button clicked for folder');
      console.log('UploadModalComponent: Hub ID:', node.hubId);
      console.log('UploadModalComponent: Project ID:', node.projectId);
      console.log('UploadModalComponent: Folder ID:', node.folderId);
      console.log('UploadModalComponent: Subfolder ID:', node.subfolderId);
      
      // Trigger file input
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
    if (!this.selectedFile || !this.accUserId) {
      console.error('UploadModalComponent: No file selected or no accUserId');
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    // Simulate progress
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
    
    // Use subfolderId if available, otherwise use folderId
    const targetFolderId = node.subfolderId || node.folderId || '';
    formData.append('folderId', targetFolderId);

    console.log('UploadModalComponent: Uploading file to folder:', targetFolderId);
    console.log('UploadModalComponent: File name:', this.selectedFile.name);
    console.log('UploadModalComponent: Form data being sent:');
    console.log('UploadModalComponent: - userId:', this.accUserId);
    console.log('UploadModalComponent: - projectId:', node.projectId);
    console.log('UploadModalComponent: - hubId:', node.hubId);
    console.log('UploadModalComponent: - folderId:', targetFolderId);
    console.log('UploadModalComponent: - file:', this.selectedFile.name, this.selectedFile.size, 'bytes');

    // Log the actual FormData contents for debugging
    for (let [key, value] of formData.entries()) {
      console.log('UploadModalComponent: FormData entry:', key, '=', value);
    }

    this.http.post('http://localhost:3005/acc-docs-upload/upload', formData).subscribe({
      next: (response: any) => {
        console.log('UploadModalComponent: Upload successful:', response);
        clearInterval(progressInterval);
        const fileName = this.selectedFile?.name || 'Unknown file';
        this.uploading = false;
        this.uploadProgress = 100;
        this.selectedFile = null;
        
        // Show success message
        alert(`File "${fileName}" uploaded successfully to "${node.name}"`);
      },
      error: (error) => {
        console.error('UploadModalComponent: Upload failed:', error);
        console.error('UploadModalComponent: Error status:', error.status);
        console.error('UploadModalComponent: Error statusText:', error.statusText);
        console.error('UploadModalComponent: Error response:', error.error);
        console.error('UploadModalComponent: Full error object:', error);
        
        clearInterval(progressInterval);
        this.uploading = false;
        this.uploadProgress = 0;
        this.selectedFile = null;
        
        // Show error message with more details
        let errorMessage = 'Upload failed';
        if (error.error?.message) {
          errorMessage += `: ${error.error.message}`;
        } else if (error.message) {
          errorMessage += `: ${error.message}`;
        } else if (error.status) {
          errorMessage += ` (Status: ${error.status})`;
        }
        alert(errorMessage);
      }
    });
  }
} 