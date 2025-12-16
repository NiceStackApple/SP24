
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
    let unsubscribeDoc = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Cleanup previous listener if any
      unsubscribeDoc();

      if (currentUser) {
         const username = currentUser.email?.split('@')[0];
         if (username) {
             const docRef = doc(db, 'users', username);
             
             // Real-time listener for User Data
             // This is crucial for 'active_session_id' updates (Surrender/Leave)
             unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
                 if (docSnap.exists()) {
                     setUserData(docSnap.data() as UserDocument);
                 } else {
                     // SELF-HEAL: Attempt to recreate user doc if missing
                     console.warn("User document missing. Attempting self-heal recreation.");
                     const recoveredUser: UserDocument = {
                        username: username,
                        security_question: "Recovery",
                        security_answer: "Recovery",
                        created_at: serverTimestamp(),
                        active_session_id: null,
                        stats: {
                            total_matches: 0,
                            wins: 0,
                            kills: 0,
                            days_survived: 0
                        }
                     };
                     setDoc(docRef, recoveredUser).catch(console.error);
                     // setDoc will trigger the snapshot again
                 }
                 setLoading(false);
             }, (err) => {
                 console.error("Failed to fetch user data:", err);
                 // Do not block app, but data might be missing
                 setLoading(false);
             });
         } else {
             setLoading(false);
         }
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        unsubscribeDoc();
    };
  }, []);

  const login = async (username: string, pass: string) => {
    const email = `${username}@survival.game`;
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (username: string, pass: string, securityQ: string, securityA: string) => {
    const email = `${username}@survival.game`;
    
    // 1. Create Auth User
    await createUserWithEmailAndPassword(auth, email, pass);
    
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
