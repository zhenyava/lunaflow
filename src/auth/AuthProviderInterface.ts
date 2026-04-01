export interface AuthProvider {
  readonly id: string;
  readonly name: string;
  initialize(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  isAuthenticated(): boolean;
  getToken(): Promise<{ access_token: string }>;
  onAuthStateChange(fn: (isAuthenticated: boolean) => void): () => void;
}
