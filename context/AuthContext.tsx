
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserDocument } from '../types';

interface AuthContextType {
  user: User | null;
  userData: UserDocument | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  register: (username: string, pass: string, securityQ: string, securityA: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
         // Email format: username@survival.game
         // Extract username from email
         const username = currentUser.email?.split('@')[0];
         if (username) {
             const docRef = doc(db, 'users', username);
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
                 setUserData(docSnap.data() as UserDocument);
             }
         }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (username: string, pass: string) => {
    const email = `${username}@survival.game`;
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (username: string, pass: string, securityQ: string, securityA: string) => {
    const email = `${username}@survival.game`;
    
    // 1. Create Auth User
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    
    // 2. Create Firestore User Document
    const newUser: UserDocument = {
        username: username,
        security_question: securityQ,
        security_answer: securityA,
        created_at: serverTimestamp(),
        active_session_id: null,
        stats: {
            total_matches: 0,
            wins: 0,
            kills: 0,
            days_survived: 0
        }
    };
    
    await setDoc(doc(db, 'users', username), newUser);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
