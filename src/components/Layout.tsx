import { ReactNode, useEffect, useState, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ShadowCompanion } from './ShadowCompanion';
import { Chatbot } from './Chatbot';
import { NicknameModal } from './NicknameModal';
import { AdBanner } from './AdBanner';
import { useUserStore, calculateLevel, getRank } from '../store/useUserStore';
import { doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Layout({ children }: { children: ReactNode }) {
  const { setAuthUser, setProfile, setIsLoading, profile, updateActiveMinutes } = useUserStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const xpTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Presence System
  useEffect(() => {
    if (!profile) return;
    
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        updateActiveMinutes();
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [profile?.uid, updateActiveMinutes]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
        if (!user.emailVerified && !isGoogle) {
          // Allow unverified users to be signed out if they just registered
          auth.signOut();
          setAuthUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }
      }

      setAuthUser(user);
      
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const missingFields: any = {};
            if (data.xp === undefined) missingFields.xp = 0;
            if (data.level === undefined) missingFields.level = 1;
            if (data.rank === undefined) missingFields.rank = 'E';
            if (data.coins === undefined) missingFields.coins = 100;
            if (data.voidCrystals === undefined) missingFields.voidCrystals = 0;
            if (data.abyssalDust === undefined) missingFields.abyssalDust = 0;
            if (data.energy === undefined) missingFields.energy = 100;
            if (data.timeSpent === undefined) missingFields.timeSpent = 0;
            if (data.lastLogin === undefined) missingFields.lastLogin = new Date().toISOString();
            if (data.nsfwEnabled === undefined) missingFields.nsfwEnabled = false;
            if (data.role === undefined) missingFields.role = 'user';
            if (data.uid === undefined) missingFields.uid = user.uid;
            if (data.pityCounter === undefined) missingFields.pityCounter = 0;
            
            if (data.displayName === null) missingFields.displayName = '';
            if (data.email === null) missingFields.email = '';
            if (data.photoURL === null) missingFields.photoURL = '';
            
            if (Object.keys(missingFields).length > 0) {
              try {
                await setDoc(userRef, missingFields, { merge: true });
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }

            // Hellish Leveling Check
            const currentXp = data.xp || 0;
            const newLevel = calculateLevel(currentXp);
            if (newLevel !== data.level) {
              try {
                await updateDoc(userRef, {
                  level: newLevel,
                  rank: getRank(newLevel)
                });
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }

            // Daily Reset Check (US Time - Midnight)
            const d = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = formatter.formatToParts(d);
            const year = parts.find(p => p.type === 'year')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            const todayUS = `${year}-${month}-${day}`;
            
            if (data.dailyQuestsReset !== todayUS) {
              const currentCompleted = data.completedQuests || [];
              const achievementsOnly = currentCompleted.filter((id: string) => !id.startsWith('d'));
              
              // Weekly Streak Logic (Resets on Sunday)
              const usDateObj = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
              const dayOfWeek = usDateObj.getDay(); // 0 = Sunday, 1 = Monday
              const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              const mondayDate = new Date(usDateObj);
              mondayDate.setDate(usDateObj.getDate() - diffToMonday);
              const currentWeekStr = `${mondayDate.getFullYear()}-${mondayDate.getMonth() + 1}-${mondayDate.getDate()}`;

              let weeklyLogins = data.loginStreak || 0;
              if (data.lastStreakClaim !== currentWeekStr) {
                  weeklyLogins = 0; // Reset if it's a new week
              }
              weeklyLogins += 1;

              let gaveSSR = false;
              // If they reached 7 logins this week, and haven't claimed this week's SSR
              if (weeklyLogins >= 7 && data.lastWeeklyReward !== currentWeekStr) {
                  gaveSSR = true;
              }

              // Wealth Tax Logic
              let taxAmount = 0;
              const hasProtection = data.protectionWardUntil && new Date(data.protectionWardUntil) > new Date();
              if (data.coins > 1000000 && !hasProtection) {
                taxAmount = Math.floor(data.coins * 0.02); // 2% tax
              }

              let coinsChange = 0;
              if (taxAmount > 0) coinsChange -= taxAmount;
              if (gaveSSR) coinsChange += 100000;

              try {
                await updateDoc(userRef, {
                  dailyQuestsReset: todayUS,
                  completedQuests: achievementsOnly,
                  trailersWatched: 0,
                  mediaViewedCount: 0,
                  searchPerformed: false,
                  marketVisited: false,
                  gachaPullsToday: 0,
                  todayArenaAttacks: 0,
                  todayGoldSpent: 0,
                  dailyActiveMinutes: 0,
                  energy: 100, // Refill energy daily
                  loginStreak: weeklyLogins,
                  lastStreakClaim: currentWeekStr,
                  lastTaxTime: new Date().toISOString(),
                  ...(coinsChange !== 0 ? { coins: increment(coinsChange) } : {}),
                  ...(gaveSSR ? { 
                    lastWeeklyReward: currentWeekStr,
                    xp: increment(5000) 
                  } : {})
                });
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }

            setProfile({ ...data, ...missingFields } as any);
          } else {
            try {
              await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                xp: 0,
                level: 1,
                rank: 'E',
                coins: 100,
                voidCrystals: 0,
                abyssalDust: 0,
                energy: 100,
                timeSpent: 0,
                lastLogin: new Date().toISOString(),
                nsfwEnabled: false,
                role: 'user',
                inventory: [],
                activeBoosts: {},
                pityCounter: 0,
              });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`);
            }
          }
          setIsLoading(false);
        }, (error) => {
          setIsLoading(false);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [setAuthUser, setProfile, setIsLoading]);

  // Browsing XP Timer (1 XP every 60 seconds) & Energy Regen (1 Energy every 10 mins)
  useEffect(() => {
    if (profile?.uid) {
      xpTimerRef.current = setInterval(async () => {
        try {
          const userRef = doc(db, 'users', profile.uid);
          // Only increment energy if it's less than 100, and do it 1/10th of the time (every 10 mins)
          const shouldRegenEnergy = Math.random() < 0.1 && profile.energy < 100;
          
          await updateDoc(userRef, {
            xp: increment(1),
            timeSpent: increment(1),
            ...(shouldRegenEnergy ? { energy: increment(1) } : {})
          });
        } catch (e) {
          console.error("Failed to grant passive rewards", e);
        }
      }, 60000);
    }
    return () => {
      if (xpTimerRef.current) clearInterval(xpTimerRef.current);
    };
  }, [profile?.uid, profile?.energy]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 md:pl-64 transition-all duration-300">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 md:p-8 pt-24 md:pt-28 max-w-[1600px] mx-auto w-full flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <AdBanner />
        </main>
      </div>

      <ShadowCompanion />
      <Chatbot />
      <NicknameModal />
    </div>
  );
}
