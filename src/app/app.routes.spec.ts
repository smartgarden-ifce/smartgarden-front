import { routes } from './app.routes';

describe('application routes', () => {
  it('should expose the four pages inside the shared shell', () => {
    const children = routes[0].children ?? [];
    expect(children.map((route) => route.path)).toEqual(['', 'dashboard', 'monitoramento', 'dispositivos', 'relatorios']);
    expect(children[0].redirectTo).toBe('dashboard');
  });

  it('should redirect unknown routes to the dashboard', () => {
    expect(routes.at(-1)?.path).toBe('**');
    expect(routes.at(-1)?.redirectTo).toBe('dashboard');
  });
});
