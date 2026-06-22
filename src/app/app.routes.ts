import { Routes } from '@angular/router';

import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { ReportsPageComponent } from './features/reports/reports-page.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardPageComponent
  },
  {
    path: 'relatorios',
    component: ReportsPageComponent
  }
];
