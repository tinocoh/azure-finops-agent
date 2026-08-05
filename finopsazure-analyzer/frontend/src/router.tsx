import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type RouterState = {
  path: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

const RouterContext = createContext<RouterState | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const value = useMemo<RouterState>(() => ({
    path,
    navigate: (to, options) => {
      if (options?.replace) {
        window.history.replaceState(null, '', to);
      } else {
        window.history.pushState(null, '', to);
      }
      setPath(currentPath());
    },
  }), [path]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter() {
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error('Router components must be rendered inside BrowserRouter.');
  }
  return router;
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const cleanPath = path.split(/[?#]/)[0];
  if (pattern === '*') return {};

  const patternParts = pattern.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const pathParts = cleanPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

export function Routes({ children }: { children: React.ReactNode }) {
  const { path } = useRouter();
  const routes = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<RouteProps>[];
  const fallback = routes.find((route) => route.props.path === '*');

  for (const route of routes) {
    const params = matchPath(route.props.path, path);
    if (params) {
      return <ParamsContext.Provider value={params}>{route.props.element}</ParamsContext.Provider>;
    }
  }

  return fallback ? <ParamsContext.Provider value={{}}>{fallback.props.element}</ParamsContext.Provider> : null;
}

type RouteProps = {
  path: string;
  element: React.ReactNode;
};

export function Route(_props: RouteProps) {
  return null;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);
  return null;
}

export function Link({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function NavLink({
  to,
  end,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
  children: React.ReactNode;
}) {
  const { path, navigate } = useRouter();
  const current = path.split(/[?#]/)[0];
  const isActive = end ? current === to : current === to || current.startsWith(`${to}/`);
  const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className;

  return (
    <a
      href={to}
      className={resolvedClassName}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function useNavigate() {
  return useRouter().navigate;
}

export function useParams<TParams extends Record<string, string | undefined> = Record<string, string>>() {
  return useContext(ParamsContext) as TParams;
}
