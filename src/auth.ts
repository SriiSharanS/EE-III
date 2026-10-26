const persistentSessionKey = 'codeassess.portal.session';
const temporarySessionKey = 'codeassess.portal.temporary-session';

export interface PortalSession {
  email: string;
  name: string;
}

interface LoginResponseData {
  success: boolean;
  message: string;
  user?: {
    email: string;
    name: string;
  } | null;
}

function readSession(storage: Storage, key: string): PortalSession | null {
  try {
    const value = storage.getItem(key);
    if (!value) return null;

    const session = JSON.parse(value) as Partial<PortalSession>;
    if (typeof session.email !== 'string' || typeof session.name !== 'string') {
      storage.removeItem(key);
      return null;
    }

    return { email: session.email, name: session.name };
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function getPortalSession(): PortalSession | null {
  return (
    readSession(window.sessionStorage, temporarySessionKey) ??
    readSession(window.localStorage, persistentSessionKey)
  );
}

export function createPortalSession(email: string, name: string, remember: boolean): PortalSession {
  const session = { email, name };

  clearPortalSession();
  const storage = remember ? window.localStorage : window.sessionStorage;
  const key = remember ? persistentSessionKey : temporarySessionKey;
  storage.setItem(key, JSON.stringify(session));

  return session;
}

export async function authenticatePortalUser(
  email: string,
  password: string,
  remember: boolean,
): Promise<PortalSession> {
  const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as LoginResponseData;
  if (!response.ok || !payload.success || !payload.user) {
    throw new Error(payload.message || 'Authentication failed.');
  }

  return createPortalSession(payload.user.email, payload.user.name, remember);
}

export function clearPortalSession(): void {
  window.localStorage.removeItem(persistentSessionKey);
  window.sessionStorage.removeItem(temporarySessionKey);
}
