import { useEffect, useState } from 'react';
import { Editor } from './pages/Editor';
import { Library } from './pages/Library';

type Route = { name: 'library' } | { name: 'editor'; projectId: number };

function parseRoute(pathname: string): Route {
  const m = /^\/projects\/(\d+)\/?$/.exec(pathname);
  if (m) return { name: 'editor', projectId: Number(m[1]) };
  return { name: 'library' };
}

/** Two screens, one tiny history-API router. No router library needed yet. */
export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
  };

  if (route.name === 'editor') {
    return <Editor projectId={route.projectId} onBack={() => navigate('/')} />;
  }
  return <Library onOpenProject={(id) => navigate(`/projects/${id}`)} />;
}
