
import { UserProfile, Account } from '../types';

const ACCOUNTS_KEY = 'SP24_ACCOUNTS';
const SESSION_KEY = 'SP24_SESSION_USER';

// Simple synchronous hash function for prototype purposes (djb2)
// In a real app, use bcrypt/argon2 on a backend.
const simpleHash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash.toString(16);
};

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  avatarId: 99,
  matchesPlayed: 0,
  wins: 0,
  kills: 0,
  deaths: 0
};

class StorageService {
  private accounts: Record<string, Account> = {};
  private currentUser: string | null = null;

  constructor() {
    this.loadAccounts();
    this.currentUser = localStorage.getItem(SESSION_KEY);
  }

  private loadAccounts() {
    try {
      const stored = localStorage.getItem(ACCOUNTS_KEY);
      if (stored) {
        this.accounts = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load accounts', e);
      this.accounts = {};
    }
  }

  private saveAccounts() {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
    } catch (e) {
      console.error('Failed to save accounts', e);
    }
  }

  // --- AUTHENTICATION ---

  register(username: string, pass: string, secondPass: string): { success: boolean; error?: string } {
    if (!username || !pass || !secondPass) return { success: false, error: 'All fields required' };
    if (this.accounts[username]) return { success: false, error: 'Username already taken' };

    const newAccount: Account = {
      username,
      passwordHash: simpleHash(pass),
      secondPasswordHash: simpleHash(secondPass),
      profile: {
        ...DEFAULT_PROFILE,
        name: username,
        avatarId: Math.floor(Math.random() * 70)
      }
    };

    this.accounts[username] = newAccount;
    this.saveAccounts();
    return { success: true };
  }

  login(username: string, pass: string): { success: boolean; error?: string } {
    const acc = this.accounts[username];
    if (!acc) return { success: false, error: 'Account not found' };
    
    if (acc.passwordHash !== simpleHash(pass)) {
      return { success: false, error: 'Incorrect password' };
    }

    this.currentUser = username;
    localStorage.setItem(SESSION_KEY, username);
    return { success: true };
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.currentUser && !!this.accounts[this.currentUser];
  }

  getCurrentUser(): UserProfile | null {
    if (!this.currentUser || !this.accounts[this.currentUser]) return null;
    return this.accounts[this.currentUser].profile;
  }

  // --- STATS ---

  getProfile(): UserProfile {
    // Return current user profile or a dummy one if not logged in
    const user = this.getCurrentUser();
    return user || DEFAULT_PROFILE;
  }

  saveProfile(updates: Partial<UserProfile>) {
    if (!this.currentUser || !this.accounts[this.currentUser]) return;
    
    // Update the profile in the account
    this.accounts[this.currentUser].profile = {
      ...this.accounts[this.currentUser].profile,
      ...updates
    };
    this.saveAccounts();
  }

  updateStats(stats: { won?: boolean; killed?: number; died?: boolean }) {
    if (!this.currentUser || !this.accounts[this.currentUser]) return;

    const current = this.accounts[this.currentUser].profile;
    const updated: UserProfile = {
      ...current,
      matchesPlayed: current.matchesPlayed + 1,
      wins: current.wins + (stats.won ? 1 : 0),
      kills: current.kills + (stats.killed || 0),
      deaths: current.deaths + (stats.died ? 1 : 0),
    };
    
    this.accounts[this.currentUser].profile = updated;
    this.saveAccounts();
  }
}

export const storageService = new StorageService();
