# Rule2 Modal Component

A specialized modal component for displaying parking accessibility compliance validation results in the Design Checker application.

## Overview

The Rule2 Modal is designed to show detailed results from parking accessibility compliance checks, including:

- Parking analysis summary with counts and requirements
- Validation results for individual parking elements
- Compliance status and shortfall calculations
- Integration with ACC issue management

## Features

- **Parking Analysis Display**: Shows total, normal, and handicapped parking spaces with requirements
- **Validation Results**: Lists individual validation results with status indicators
- **Compliance Summary**: Clear overview of overall compliance status
- **Responsive Design**: Works on both desktop and mobile devices
- **Interactive Elements**: Buttons for viewing ACC issues and highlighting failed elements

## Data Structure

The component expects data in the following format:

```typescript
interface Rule2ValidationData {
  validationResults: ValidationResult[];
  parkingAnalysis: ParkingAnalysis;
}

interface ValidationResult {
  typeId: string;
  typeName: string;
  familyName: string;
  widthMm: number;
  isValid: boolean;
  elementIds: string[];
}

interface ParkingAnalysis {
  totalParkingSpaces: number;
  normalParkingSpaces: number;
  handicappedParkingSpaces: number;
  requiredHandicappedSpaces: number;
  actualHandicappedSpaces: number;
  shortfall: number;
  isValidationPassed: boolean;
  validationMessage: string;
}
```

## Usage

### Basic Implementation

```typescript
import { Rule2ModalComponent } from "./components/rule2-modal";

@Component({
  selector: "app-example",
  template: ` <app-rule2-modal [isVisible]="showModal" [validationData]="parkingData" [loading]="false" [error]="" [issuesCreated]="0" [highlight]="false" (close)="onClose()" (showAccIssues)="onShowAccIssues()" (cdpdClick)="onCdpdClick()" (retry)="onRetry()"></app-rule2-modal> `,
})
export class ExampleComponent {
  showModal = false;
  parkingData: Rule2ValidationData = {
    // Your parking validation data here
  };

  onClose() {
    this.showModal = false;
  }

  onShowAccIssues() {
    // Handle showing ACC issues
  }

  onCdpdClick() {
    // Handle highlighting failed elements
  }

  onRetry() {
    // Handle retry logic
  }
}
```

### Input Properties

- `isVisible`: Boolean to control modal visibility
- `validationData`: The parking validation data to display
- `loading`: Boolean to show loading state
- `error`: Error message string (empty if no error)
- `issuesCreated`: Number of ACC issues created
- `highlight`: Boolean to show/hide highlight button

### Output Events

- `close`: Emitted when modal is closed
- `showAccIssues`: Emitted when "View Issues" button is clicked
- `cdpdClick`: Emitted when highlight button is clicked
- `retry`: Emitted when retry button is clicked

## Example Data

Here's an example of the data structure the component expects:

```json
{
  "validationResults": [
    {
      "typeId": "parking_accessibility_validation",
      "typeName": "Parking Accessibility Compliance",
      "familyName": "Handicapped Parking Requirements",
      "widthMm": 0,
      "isValid": true,
      "elementIds": []
    }
  ],
  "parkingAnalysis": {
    "totalParkingSpaces": 63,
    "normalParkingSpaces": 61,
    "handicappedParkingSpaces": 2,
    "requiredHandicappedSpaces": 2,
    "actualHandicappedSpaces": 2,
    "shortfall": 0,
    "isValidationPassed": true,
    "validationMessage": "PASSED: 2 handicapped spaces provided (2 required for 61 normal spaces)"
  }
}
```

## Styling

The component includes comprehensive SCSS styling with:

- Modern gradient headers
- Responsive grid layouts
- Status-based color coding (green for valid, red for invalid)
- Hover effects and transitions
- Mobile-responsive design

## Integration

This component is designed to work alongside the existing rule modal system and can be integrated into:

- Main rule checking workflows
- Parking-specific validation processes
- ACC issue management systems
- Viewer highlighting functionality

## Dependencies

- Angular Common Module
- Font Awesome icons (for status indicators)
- No external dependencies required
