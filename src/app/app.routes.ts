import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/app-shell/app-shell.component').then((module) => module.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard-page.component').then((module) => module.DashboardPageComponent)
      },
      {
        path: 'monitoramento',
        loadComponent: () => import('./features/monitoring/monitoring-page.component').then((module) => module.MonitoringPageComponent)
      },
      {
        path: 'dispositivos',
        loadComponent: () => import('./features/devices/devices-page.component').then((module) => module.DevicesPageComponent)
      },
      {
        path: 'relatorios',
        loadComponent: () => import('./features/reports/reports-page.component').then((module) => module.ReportsPageComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
