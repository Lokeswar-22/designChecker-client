import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { DocumentsService } from '../../services/documents.service';
import { ViewerService } from '../../services/viewer.service';

@Component({
  selector: 'app-elements-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './elements-modal.html',
  styleUrl: './elements-modal.scss',
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
    if (
      this.isVisible &&
      this.elementGroupId &&
      this.accUserId &&
      this.categoryName
    ) {
      this.loadElements();
    }
  }

  ngOnChanges() {
    if (
      this.isVisible &&
      this.elementGroupId &&
      this.accUserId &&
      this.categoryName
    ) {
      this.loadElements();
    }
  }

  loadElements() {
    this.loading = true;
    this.error = '';
    this.elements = [];

    const propertyFilter = `property.name.category==${this.categoryName}`;

    this.documentsService
      .getElementsByCategory(
        this.elementGroupId,
        this.accUserId,
        propertyFilter
      )
      .subscribe({
        next: (response: any) => {
          this.elements = this.extractElementsFromResponse(response);

          this.filteredElements = [];
          this.isRule1Applied = false;

          this.extractRevitElementIdsWithInstanceContext();

          this.loading = false;
        },
        error: (error: any) => {
          console.error(
            'ElementsModalComponent: Error loading elements:',
            error
          );
          console.error(
            'ElementsModalComponent: Error details:',
            error.error || error.message
          );
          this.error = 'Failed to load elements';
          this.loading = false;
        },
      });
  }

  extractElementsFromResponse(response: any): any[] {
    if (!response) return [];

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

    if (typeof response === 'object' && response !== null) {
      return [response];
    }

    return [];
  }

  extractRevitElementIdsWithInstanceContext() {
    if (!this.elements || this.elements.length === 0) {
      return;
    }

    const revitElementIds: string[] = [];

    this.elements.forEach((element) => {
      const properties = this.getAllProperties(element);

      const elementContextProperty = properties.find(
        (prop) =>
          prop.name === 'Element Context' ||
          prop.name === 'elementContext' ||
          prop.name === 'ElementContext'
      );

      if (
        elementContextProperty &&
        elementContextProperty.value === 'Instance'
      ) {
        // Find the "Revit Element ID" property
        const revitElementIdProperty = properties.find(
          (prop) =>
            prop.name === 'Revit Element ID' ||
            prop.name === 'revitElementId' ||
            prop.name === 'RevitElementId'
        );

        if (revitElementIdProperty && revitElementIdProperty.value) {
          revitElementIds.push(revitElementIdProperty.value);
        }
      }
    });

    this.viewerService.highlightElements(revitElementIds);
  }

  extractRevitElementIdsFromFilteredElements() {
    if (!this.filteredElements || this.filteredElements.length === 0) {
      return;
    }

    const revitElementIds: string[] = [];

    this.filteredElements.forEach((element) => {
      const properties = this.getAllProperties(element);

      const revitElementIdProperty = properties.find(
        (prop) =>
          prop.name === 'Revit Element ID' ||
          prop.name === 'revitElementId' ||
          prop.name === 'RevitElementId'
      );

      if (revitElementIdProperty && revitElementIdProperty.value) {
        revitElementIds.push(revitElementIdProperty.value);
        console.log(
          'ElementsModalComponent: Found filtered element - Revit Element ID:',
          revitElementIdProperty.value
        );
      }
    });

    if (revitElementIds.length > 0) {
      this.viewerService.highlightElements(revitElementIds);
    }
  }

  onClose() {
    this.close.emit();
  }

  onHighlightClick() {
    if (this.isRule1Applied && this.filteredElements.length > 0) {
      this.extractRevitElementIdsFromFilteredElements();
    } else {
      this.extractRevitElementIdsWithInstanceContext();
    }
  }

  onRule1Click() {
    if (this.categoryName !== 'Doors') {
      return;
    }
    this.applyRule1Filter();
  }

  applyRule1Filter() {
    if (!this.elements || this.elements.length === 0) {
      console.warn('ElementsModalComponent: No elements to filter');
      return;
    }

    const widthPropertyNames = [
      'Door Opening Width',
      'Clear Opening Width',
      'Width',
      'MF Opening Width',
      'Rough Width',
      'Panel Width',
    ];

    this.filteredElements = this.elements.filter((element) => {
      const properties = this.getAllProperties(element);

      const elementContextProperty = properties.find(
        (prop) =>
          prop.name === 'Element Context' ||
          prop.name === 'elementContext' ||
          prop.name === 'ElementContext'
      );

      if (
        !elementContextProperty ||
        elementContextProperty.value !== 'Instance'
      ) {
        return false;
      }

      const hasValidWidthProperty = widthPropertyNames.some((propName) => {
        const property = properties.find((prop) => prop.name === propName);
        if (
          !property ||
          property.value === null ||
          property.value === undefined
        ) {
          return false;
        }

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
    const property = properties?.find((p) => p.name === propertyName);
    return property?.value || 'N/A';
  }

  getPropertyUnit(properties: any[], propertyName: string): string {
    const property = properties?.find((p) => p.name === propertyName);
    return property?.definition?.units?.name || '';
  }

  getAllProperties(element: any): any[] {
    if (!element) return [];

    // Handle different property structures
    if (element.properties?.results) {
      return element.properties.results;
    }

    if (element.properties) {
      return Array.isArray(element.properties)
        ? element.properties
        : [element.properties];
    }

    if (element.attributes) {
      return Array.isArray(element.attributes)
        ? element.attributes
        : [element.attributes];
    }

    // If element itself has properties as direct keys
    const directProperties = [];
    for (const [key, value] of Object.entries(element)) {
      if (
        key !== 'id' &&
        key !== 'name' &&
        key !== 'properties' &&
        key !== 'attributes'
      ) {
        directProperties.push({
          name: key,
          value: value,
          definition: { units: null },
        });
      }
    }

    return directProperties;
  }

  getCommonPropertyNames(): string[] {
    if (this.elements.length === 0) return [];

    const allPropertyNames = new Set<string>();

    this.elements.forEach((element) => {
      const properties = this.getAllProperties(element);
      properties.forEach((prop) => {
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
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }
}
