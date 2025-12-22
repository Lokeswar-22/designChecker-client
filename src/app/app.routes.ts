import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DocumentsComponent } from './components/documents/documents.component';
import { ElementGroupDetailsComponent } from './components/element-group-details/element-group-details.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'documents', component: DocumentsComponent, canActivate: [AuthGuard] },
  { path: 'element-group/:elementGroupId/:elementGroupName', component: ElementGroupDetailsComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/login' }
];
