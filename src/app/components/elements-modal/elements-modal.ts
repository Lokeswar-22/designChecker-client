import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentsService } from '../../services/documents.service';

@Component({
  selector: 'app-elements-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './elements-modal.html',
  styleUrl: './elements-modal.scss'
})
export class ElementsModalComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Input() elementGroupId: string = '';
  @Input() accUserId: string = '';
  @Input() categoryName: string = '';
  @Output() close = new EventEmitter<void>();

  loading = false;
  elements: any[] = [];
  error: string = '';
  viewMode: 'table' | 'cards' | 'json' = 'table';

  constructor(private documentsService: DocumentsService) {}

  ngOnInit() {
    if (this.isVisible && this.elementGroupId && this.accUserId && this.categoryName) {
      this.loadElements();
    }
  }

  ngOnChanges() {
    if (this.isVisible && this.elementGroupId && this.accUserId && this.categoryName) {
      this.loadElements();
    }
  }

  loadElements() {
    console.log('ElementsModalComponent: Loading elements for category:', this.categoryName);
    console.log('ElementsModalComponent: elementGroupId:', this.elementGroupId);
    console.log('ElementsModalComponent: accUserId:', this.accUserId);
    
    this.loading = true;
    this.error = '';
    this.elements = [];

    const propertyFilter = `property.name.category==${this.categoryName}`;
    console.log('ElementsModalComponent: propertyFilter:', propertyFilter);

    this.documentsService.getElementsByCategory(this.elementGroupId, this.accUserId, propertyFilter).subscribe({
      next: (response: any) => {
        console.log('ElementsModalComponent: Elements response:', response);
        
        // Handle different response structures dynamically
        this.elements = this.extractElementsFromResponse(response);
        console.log('ElementsModalComponent: Elements loaded:', this.elements.length);
        
        this.loading = false;
      },
      error: (error: any) => {
        console.error('ElementsModalComponent: Error loading elements:', error);
        console.error('ElementsModalComponent: Error details:', error.error || error.message);
        this.error = 'Failed to load elements';
        this.loading = false;
      }
    });
  }

  extractElementsFromResponse(response: any): any[] {
    if (!response) return [];

    // Try different possible response structures
    if (response.elementsByElementGroup?.results) {
      return response.elementsByElementGroup.results;
    }
    
    if (response.results) {
      return response.results;
    }
    
    if (response.elements) {
      return response.elements;
    }
    
    if (Array.isArray(response)) {
      return response;
    }
    
    // If response is a single object, wrap it in an array
    if (typeof response === 'object' && response !== null) {
      return [response];
    }
    
    return [];
  }

  onClose() {
    console.log('ElementsModalComponent: Modal closed');
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  setViewMode(mode: 'table' | 'cards' | 'json') {
    this.viewMode = mode;
  }

  getPropertyValue(properties: any[], propertyName: string): any {
    const property = properties?.find(p => p.name === propertyName);
    return property?.value || 'N/A';
  }

  getPropertyUnit(properties: any[], propertyName: string): string {
    const property = properties?.find(p => p.name === propertyName);
    return property?.definition?.units?.name || '';
  }

  getAllProperties(element: any): any[] {
    if (!element) return [];
    
    // Handle different property structures
    if (element.properties?.results) {
      return element.properties.results;
    }
    
    if (element.properties) {
      return Array.isArray(element.properties) ? element.properties : [element.properties];
    }
    
    if (element.attributes) {
      return Array.isArray(element.attributes) ? element.attributes : [element.attributes];
    }
    
    // If element itself has properties as direct keys
    const directProperties = [];
    for (const [key, value] of Object.entries(element)) {
      if (key !== 'id' && key !== 'name' && key !== 'properties' && key !== 'attributes') {
        directProperties.push({
          name: key,
          value: value,
          definition: { units: null }
        });
      }
    }
    
    return directProperties;
  }

  getCommonPropertyNames(): string[] {
    if (this.elements.length === 0) return [];
    
    const allPropertyNames = new Set<string>();
    
    this.elements.forEach(element => {
      const properties = this.getAllProperties(element);
      properties.forEach(prop => {
        if (prop.name) {
          allPropertyNames.add(prop.name);
        }
      });
    });
    
    return Array.from(allPropertyNames).sort();
  }

  formatPropertyValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value.toString();
  }

  getPropertyDisplayName(propertyName: string): string {
    // Convert camelCase or snake_case to Title Case
    return propertyName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }
} 