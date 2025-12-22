import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentsService } from '../../services/documents.service';

@Component({
  selector: 'app-elements-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './elements-modal.component.html',
  styleUrl: './elements-modal.component.scss'
})
export class ElementsModalComponent implements OnInit, OnChanges {
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
    this.loading = true;
    this.error = '';
    this.elements = [];

    const propertyFilter = `property.name.category==${this.categoryName}`;

    this.documentsService.getElementsByCategory(this.elementGroupId, this.accUserId, propertyFilter).subscribe({
      next: (response: any) => {
        this.elements = this.extractElementsFromResponse(response);
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load elements';
        this.loading = false;
      }
    });
  }

  extractElementsFromResponse(response: any): any[] {
    if (!response) return [];
    if (response.elementsByElementGroup?.results) return response.elementsByElementGroup.results;
    if (response.results) return response.results;
    if (response.elements) return response.elements;
    if (Array.isArray(response)) return response;
    if (typeof response === 'object' && response !== null) return [response];
    return [];
  }

  onClose() {
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
    if (element.properties?.results) return element.properties.results;
    if (element.properties) return Array.isArray(element.properties) ? element.properties : [element.properties];
    if (element.attributes) return Array.isArray(element.attributes) ? element.attributes : [element.attributes];

    return Object.entries(element)
      .filter(([key]) => !['id', 'name', 'properties', 'attributes'].includes(key))
      .map(([key, value]) => ({
        name: key,
        value: value,
        definition: { units: null }
      }));
  }

  getCommonPropertyNames(): string[] {
    if (this.elements.length === 0) return [];
    const allPropertyNames = new Set<string>();
    this.elements.forEach(element => {
      this.getAllProperties(element).forEach(prop => {
        if (prop.name) allPropertyNames.add(prop.name);
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
    return propertyName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }
}

