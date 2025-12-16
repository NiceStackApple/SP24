
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserProfile } from '../types';

// Legacy Types for fallback
const DEFAULT_PROFILE: UserProfile = {
  name: 'Guest',
  avatarId: 99,
  matchesPlayed: 0,
  wins: 0,
  kills: 0,
  deaths: 0
};

class StorageService {
  // Legacy method stubs to prevent crashing existing code calling them
  // Auth is now handled by AuthContext
  register() { return { success: false, error: 'Use AuthContext' }; }
  login() { return { success: false, error: 'Use AuthContext' }; }
  logout() { /* No-op, handled by AuthContext */ }
  
  isLoggedIn(): boolean {
    return !!auth.currentUser;
  }

  getCurrentUser(): UserProfile | null {
    if (!auth.currentUser) return null;
    const email = auth.currentUser.email;
    const name = email ? email.split('@')[0] : 'Unknown';
    return { ...DEFAULT_PROFILE, name }; 
  }

  // --- STATS PERSISTENCE ---

  async updateStats(stats: { won?: boolean; killed?: number; died?: boolean; days?: number }) {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    const username = user.email.split('@')[0];
    const userRef = doc(db, 'users', username);

    try {
      await updateDoc(userRef, {
        'stats.total_matches': increment(1),
        'stats.wins': increment(stats.won ? 1 : 0),
        'stats.kills': increment(stats.killed || 0),
        'stats.days_survived': increment(stats.days || 0)
      });
    } catch (e) {
      console.error("Failed to update stats:", e);
    }
  }

  // Helper to get stats for Account Modal
  async getProfileData(): Promise<UserProfile> {
     const user = auth.currentUser;
     if (!user || !user.email) return DEFAULT_PROFILE;

     const username = user.email.split('@')[0];
     try {
        const snap = await getDoc(doc(db, 'users', username));
        if (snap.exists()) {
            const data = snap.data();
            return {
                name: username,
                avatarId: 99, // Avatar Logic TBD
                matchesPlayed: data.stats.total_matches || 0,
                wins: data.stats.wins || 0,
                kills: data.stats.kills || 0,
                deaths: (data.stats.total_matches || 0) - (data.stats.wins || 0) // Approximation
            };
        }
     } catch (e) {
         console.error("Error fetching profile", e);
     }
     return { ...DEFAULT_PROFILE, name: username };
  }

  // Compat method for sync calls (returns partial data, async fetch preferred)
  getProfile(): UserProfile {
     const user = auth.currentUser;
     if (!user || !user.email) return DEFAULT_PROFILE;
     return { ...DEFAULT_PROFILE, name: user.email.split('@')[0] };
  }
  
  saveProfile(updates?: Partial<UserProfile>) {
      // Name changes handled via AuthContext/Firestore logic if needed
  }
}

export const storageService = new StorageService();