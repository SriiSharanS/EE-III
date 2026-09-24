const persistentSessionKey = 'codeassess.portal.session';
const temporarySessionKey = 'codeassess.portal.temporary-session';

export interface PortalSession {
  email: string;
  name: string;
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

export function createPortalSession(email: string, remember: boolean): PortalSession {
  const localPart = email.split('@')[0] ?? 'Student';
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const session = { email, name: name || 'Student' };

  clearPortalSession();
  const storage = remember ? window.localStorage : window.sessionStorage;
  const key = remember ? persistentSessionKey : temporarySessionKey;
  storage.setItem(key, JSON.stringify(session));

  return session;
}

export function clearPortalSession(): void {
  window.localStorage.removeItem(persistentSessionKey);
  window.sessionStorage.removeItem(temporarySessionKey);
}
