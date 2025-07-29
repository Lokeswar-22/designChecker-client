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
  @Output() rule2Click = new EventEmitter<void>();
  @Output() rule3Click = new EventEmitter<void>();
  @Output() rule4Click = new EventEmitter<void>();
  @Output() rule5Click = new EventEmitter<void>();

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
    this.rule2Click.emit();
  }

  onRule3Click() {
    this.rule3Click.emit();
  }

  onRule4Click() {
    this.rule4Click.emit();
  }

  onRule5Click() {
    this.rule5Click.emit();
  }
} 