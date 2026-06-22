import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should render the brand and all navigation destinations', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector<HTMLImageElement>('.brand-link img')?.src).toContain('smartgardenname-logo.png');
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav a')).map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/dashboard', '/monitoramento', '/dispositivos', '/relatorios']);
  });

  it('should toggle and close the mobile menu', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const component = fixture.componentInstance;

    component.toggleMenu();
    expect(component.menuOpen()).toBeTrue();
    component.closeMenuOnEscape();
    expect(component.menuOpen()).toBeFalse();
  });
});
