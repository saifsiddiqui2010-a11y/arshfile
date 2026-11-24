import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LandingView } from './components/LandingView.tsx';
import { WorkspaceView } from './components/WorkspaceView.tsx';
import { SharePage } from './components/SharePage.tsx';

function extractShareId(pathname: string): string | null {
  const match = /^\/s\/([a-zA-Z0-9_-]{6,64})\/?$/.exec(pathname);
  return match ? match[1] : null;
}

function AppRouter() {
  const { user, loading } = useAuth();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('droplink_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('droplink_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
    }
    setPathname(to);
    window.scrollTo(0, 0);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const shareId = extractShareId(pathname);

  if (shareId) {
    return (
      <SharePage
        shareId={shareId}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onGoHome={() => navigate('/')}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFB] dark:bg-[#0B0F17]">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading DropLink...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingView />;
  }

  return (
    <WorkspaceView
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onNavigateSharePage={(id) => navigate(`/s/${id}`)}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
