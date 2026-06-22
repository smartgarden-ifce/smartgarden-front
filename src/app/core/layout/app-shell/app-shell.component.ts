import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  readonly menuOpen = signal(false);
  readonly navigation: NavigationItem[] = [
    { label: 'Visão geral', icon: 'pi pi-home', route: '/dashboard' },
    { label: 'Monitoramento', icon: 'pi pi-chart-line', route: '/monitoramento' },
    { label: 'Dispositivos', icon: 'pi pi-microchip', route: '/dispositivos' },
    { label: 'Relatórios', icon: 'pi pi-file', route: '/relatorios' }
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.closeMenu();
  }
}
