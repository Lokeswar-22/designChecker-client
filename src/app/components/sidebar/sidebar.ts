import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent {
  @Input() showRules: boolean = false;
  @Output() documentsClick = new EventEmitter<void>();
  @Output() rule1Click = new EventEmitter<void>();

  showRulesSubmenu = false;

  onDocumentsClick() {
    this.documentsClick.emit();
  }

  onRulesClick() {
    this.showRulesSubmenu = !this.showRulesSubmenu;
  }

  onRule1Click() {
    this.rule1Click.emit();
  }

  onRule2Click() {
    // Dummy method for Rule 2
    console.log('Rule 2 clicked (dummy)');
  }

  onRule3Click() {
    // Dummy method for Rule 3
    console.log('Rule 3 clicked (dummy)');
  }

  onRule4Click() {
    // Dummy method for Rule 4
    console.log('Rule 4 clicked (dummy)');
  }

  onRule5Click() {
    // Dummy method for Rule 5
    console.log('Rule 5 clicked (dummy)');
  }
} 