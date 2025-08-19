import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentsService } from '../../services/documents.service';
import { ViewerService } from '../../services/viewer.service';

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
  filteredElements: any[] = [];
  error: string = '';
  viewMode: 'table' | 'cards' | 'json' = 'table';
  viewerService: ViewerService = inject(ViewerService);
  isRule1Applied: boolean = false;

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
        
        // Reset filtered elements and rule application state
        this.filteredElements = [];
        this.isRule1Applied = false;
        
        // Extract Revit Element IDs where "Element Context" = "Instance"
        this.extractRevitElementIdsWithInstanceContext();
        
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

  extractRevitElementIdsWithInstanceContext() {
    if (!this.elements || this.elements.length === 0) {
      console.log('ElementsModalComponent: No elements to process for Revit Element ID extraction');
      return;
    }

    const revitElementIds: string[] = [];

    this.elements.forEach(element => {
      const properties = this.getAllProperties(element);
      
      // Find the "Element Context" property
      const elementContextProperty = properties.find(prop => 
        prop.name === "Element Context" || 
        prop.name === "elementContext" || 
        prop.name === "ElementContext"
      );

      // Check if the property exists and has value "Instance"
      if (elementContextProperty && elementContextProperty.value === "Instance") {
        // Find the "Revit Element ID" property
        const revitElementIdProperty = properties.find(prop => 
          prop.name === "Revit Element ID" || 
          prop.name === "revitElementId" || 
          prop.name === "RevitElementId"
        );

        // Extract the Revit Element ID from the property value
        if (revitElementIdProperty && revitElementIdProperty.value) {
          revitElementIds.push(revitElementIdProperty.value);
          console.log('ElementsModalComponent: Found element with Instance context - Revit Element ID:', revitElementIdProperty.value);
        }
      }
    });

    console.log('ElementsModalComponent: Revit Element IDs with Instance context:', revitElementIds);
    this.viewerService.highlightElements(revitElementIds);
    console.log('ElementsModalComponent: Total count of elements with Instance context:', revitElementIds.length);
  }

  extractRevitElementIdsFromFilteredElements() {
    if (!this.filteredElements || this.filteredElements.length === 0) {
      console.log('ElementsModalComponent: No filtered elements to process for Revit Element ID extraction');
      return;
    }

    const revitElementIds: string[] = [];

    this.filteredElements.forEach(element => {
      const properties = this.getAllProperties(element);
      
      // Find the "Revit Element ID" property
      const revitElementIdProperty = properties.find(prop => 
        prop.name === "Revit Element ID" || 
        prop.name === "revitElementId" || 
        prop.name === "RevitElementId"
      );

      // Extract the Revit Element ID from the property value
      if (revitElementIdProperty && revitElementIdProperty.value) {
        revitElementIds.push(revitElementIdProperty.value);
        console.log('ElementsModalComponent: Found filtered element - Revit Element ID:', revitElementIdProperty.value);
      }
    });

    console.log('ElementsModalComponent: Revit Element IDs from filtered elements:', revitElementIds);
    console.log('ElementsModalComponent: Total count of filtered elements:', revitElementIds.length);
    
    // Highlight the filtered elements
    if (revitElementIds.length > 0) {
      this.viewerService.highlightElements(revitElementIds);
    }
  }

  onClose() {
    console.log('ElementsModalComponent: Modal closed');
    this.close.emit();
  }

  onHighlightClick() {
    console.log('ElementsModalComponent: Highlight button clicked');
    
    if (this.isRule1Applied && this.filteredElements.length > 0) {
      console.log('ElementsModalComponent: Highlighting filtered elements from Rule 1');
      this.extractRevitElementIdsFromFilteredElements();
    } else {
      console.log('ElementsModalComponent: Highlighting all elements with Instance context');
      this.extractRevitElementIdsWithInstanceContext();
    }
  }

  onRule1Click() {
    console.log('ElementsModalComponent: Rule 1 button clicked for Doors category');
    
    if (this.categoryName !== 'Doors') {
      console.warn('ElementsModalComponent: Rule 1 can only be applied to Doors category');
      return;
    }

    // Apply Rule 1 filtering
    this.applyRule1Filter();
  }

  applyRule1Filter() {
    if (!this.elements || this.elements.length === 0) {
      console.warn('ElementsModalComponent: No elements to filter');
      return;
    }

    // Define the width property names to check
    const widthPropertyNames = [
      'Door Opening Width',
      'Clear Opening Width',
      'Width',
      'MF Opening Width',
      'Rough Width',
      'Panel Width'
    ];

    // Filter elements based on Rule 1 criteria
    this.filteredElements = this.elements.filter(element => {
      const properties = this.getAllProperties(element);
      
      // Check if Element Context is "Instance"
      const elementContextProperty = properties.find(prop => 
        prop.name === "Element Context" || 
        prop.name === "elementContext" || 
        prop.name === "ElementContext"
      );

      if (!elementContextProperty || elementContextProperty.value !== "Instance") {
        return false;
      }

      // Check if at least one of the width properties has a valid value
      const hasValidWidthProperty = widthPropertyNames.some(propName => {
        const property = properties.find(prop => prop.name === propName);
        if (!property || property.value === null || property.value === undefined) {
          return false;
        }
        
        // Check if value is not empty string and not 0
        if (typeof property.value === 'string') {
          return property.value.trim() !== '';
        }
        if (typeof property.value === 'number') {
          return property.value !== 0;
        }
        
        return true;
      });

      return hasValidWidthProperty;
    });

    this.isRule1Applied = true;
    
    console.log('ElementsModalComponent: Rule 1 filter applied');
    console.log('ElementsModalComponent: Original elements count:', this.elements.length);
    console.log('ElementsModalComponent: Filtered elements count:', this.filteredElements.length);
    console.log('ElementsModalComponent: Filtered elements:', this.filteredElements);
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