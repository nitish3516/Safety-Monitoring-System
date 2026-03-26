export const AUTH_STORAGE_KEY = "ppe_auth";
export const REGISTERED_USER_KEY = "ppe_registered_user";

export const DEMO_CREDENTIALS = {
  email: "admin@ppe.com",
  password: "admin123",
};

type AuthState = {
  authenticated: boolean;
  email: string;
};

type RegisteredUser = {
  email: string;
  password: string;
};

export function getStoredAuth(): AuthState | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.authenticated && typeof parsed.email === "string") {
      return parsed as AuthState;
    }
  } catch {}
  return null;
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredAuth()?.authenticated);
}

export function loginUser(email: string) {
  sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      authenticated: true,
      email,
    }),
  );
}

export function logoutUser() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getRegisteredUser(): RegisteredUser | null {
  try {
    const raw = localStorage.getItem(REGISTERED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") {
      return parsed as RegisteredUser;
    }
  } catch {}
  return null;
}

export function registerUser(email: string, password: string) {
  localStorage.setItem(
    REGISTERED_USER_KEY,
    JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  );
}

export function validateCredentials(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const registered = getRegisteredUser();
  if (registered) {
    return normalizedEmail === registered.email && password === registered.password;
  }

  return normalizedEmail === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password;
}
