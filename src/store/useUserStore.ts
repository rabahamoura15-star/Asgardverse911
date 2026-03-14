import { create } from 'zustand';
import { User } from 'firebase/auth';
import { Language } from '../translations';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export interface UserProfile {
  uid: string;
  displayName: string;
  nickname?: string;
  email: string;
  photoURL: string;
  xp: number;
  level: number;
  rank: string;
  coins: number;
  voidCrystals: number;
  abyssalDust: number;
  energy: number;
  timeSpent?: number;
  lastLogin: string;
  nsfwEnabled: boolean;
  role: 'admin' | 'user';
  inventory?: any[];
  pityCounter: number;
  lastTaxTime?: string;
  protectionWardUntil?: string;
  abyssFloor?: number;
  abyssRewards?: any;
  lastRaid?: string;
  lastGateEntry?: string;
  worldBossDamage?: number;
  activeBoosts?: Record<string, string>;
  guildId?: string;
  loginStreak?: number;
  lastStreakClaim?: string;
  lastChampionReward?: string;
  championWeek?: string;
  profileBanner?: string;
  unlockedBanners?: string[];
  basePower?: number;
  hasVoidKey?: boolean;
  hasGuildToken?: boolean;
  completedQuests?: string[];
  completedDailyQuests?: string[];
  dailyQuestDate?: string;
  trailersWatched?: number;
  mediaViewedCount?: number;
  searchPerformed?: boolean;
  marketVisited?: boolean;
  gachaPullsToday?: number;
  todayArenaAttacks?: number;
  todayGoldSpent?: number;
  dailyActiveMinutes?: number;
  lastActive?: string;
  pityCounters?: Record<string, number>;
}

interface UserState {
  authUser: User | null;
  profile: UserProfile | null;
  setAuthUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  trackAction: (action: 'trailer' | 'view' | 'search' | 'market' | 'gacha') => Promise<void>;
  trackArenaAttack: () => Promise<void>;
  trackGoldSpent: (amount: number) => Promise<void>;
  updateActiveMinutes: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  authUser: null,
  profile: null,
  setAuthUser: (user) => set({ authUser: user }),
  setProfile: (profile) => set({ profile }),
  isLoading: true,
  setIsLoading: (loading) => set({ isLoading: loading }),
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  trackAction: async (action) => {
    const { profile } = get();
    if (!profile) return;

    const userRef = doc(db, 'users', profile.uid);
    let update: any = {};
    const today = new Date().toDateString();

    // Reset daily counters if it's a new day
    const isNewDay = profile.dailyQuestDate !== today;
    if (isNewDay) {
      update.dailyQuestDate = today;
      update.completedDailyQuests = [];
      update.trailersWatched = 0;
      update.mediaViewedCount = 0;
      update.searchPerformed = false;
      update.marketVisited = false;
      update.gachaPullsToday = 0;
      update.todayArenaAttacks = 0;
      update.todayGoldSpent = 0;
      update.dailyActiveMinutes = 0;
    }

    switch (action) {
      case 'trailer':
        update.trailersWatched = isNewDay ? 1 : increment(1);
        break;
      case 'view':
        update.mediaViewedCount = isNewDay ? 1 : increment(1);
        break;
      case 'search':
        update.searchPerformed = true;
        break;
      case 'market':
        update.marketVisited = true;
        break;
      case 'gacha':
        update.gachaPullsToday = isNewDay ? 1 : increment(1);
        break;
    }

    try {
      await updateDoc(userRef, update);
      // Local update
      set((state) => {
        if (!state.profile) return { profile: null };
        const p = state.profile;
        return {
          profile: {
            ...p,
            dailyQuestDate: today,
            completedDailyQuests: isNewDay ? [] : p.completedDailyQuests,
            trailersWatched: action === 'trailer' ? (isNewDay ? 1 : (p.trailersWatched || 0) + 1) : (isNewDay ? 0 : p.trailersWatched),
            mediaViewedCount: action === 'view' ? (isNewDay ? 1 : (p.mediaViewedCount || 0) + 1) : (isNewDay ? 0 : p.mediaViewedCount),
            searchPerformed: action === 'search' ? true : (isNewDay ? false : p.searchPerformed),
            marketVisited: action === 'market' ? true : (isNewDay ? false : p.marketVisited),
            gachaPullsToday: action === 'gacha' ? (isNewDay ? 1 : (p.gachaPullsToday || 0) + 1) : (isNewDay ? 0 : p.gachaPullsToday),
            todayArenaAttacks: isNewDay ? 0 : p.todayArenaAttacks,
            todayGoldSpent: isNewDay ? 0 : p.todayGoldSpent,
            dailyActiveMinutes: isNewDay ? 0 : p.dailyActiveMinutes,
          }
        };
      });
    } catch (error) {
      console.error('Failed to track action:', error);
    }
  },
  trackArenaAttack: async () => {
    const { profile } = get();
    if (!profile) return;
    const userRef = doc(db, 'users', profile.uid);
    try {
      await updateDoc(userRef, { todayArenaAttacks: increment(1) });
      set((state) => ({
        profile: state.profile ? { ...state.profile, todayArenaAttacks: (state.profile.todayArenaAttacks || 0) + 1 } : null
      }));
    } catch (e) { console.error(e); }
  },
  trackGoldSpent: async (amount) => {
    const { profile } = get();
    if (!profile) return;
    const userRef = doc(db, 'users', profile.uid);
    try {
      await updateDoc(userRef, { todayGoldSpent: increment(amount) });
      set((state) => ({
        profile: state.profile ? { ...state.profile, todayGoldSpent: (state.profile.todayGoldSpent || 0) + amount } : null
      }));
    } catch (e) { console.error(e); }
  },
  updateActiveMinutes: async () => {
    const { profile } = get();
    if (!profile) return;
    const userRef = doc(db, 'users', profile.uid);
    const now = new Date().toISOString();
    try {
      await updateDoc(userRef, { 
        dailyActiveMinutes: increment(1),
        lastActive: now
      });
      set((state) => ({
        profile: state.profile ? { 
          ...state.profile, 
          dailyActiveMinutes: (state.profile.dailyActiveMinutes || 0) + 1,
          lastActive: now
        } : null
      }));
    } catch (e) { console.error(e); }
  }
}));

export const calculateLevel = (xp: number) => {
  // Level XP = Level^4 * 250 (Extremely Hellish leveling)
  let level = 1;
  while (Math.pow(level, 4) * 250 <= xp) {
    level++;
  }
  return level;
};

export const getRank = (level: number) => {
  if (level >= 1000) return 'GOD';
  if (level >= 500) return 'X';
  if (level >= 250) return 'SSS';
  if (level >= 150) return 'SS';
  if (level >= 100) return 'S';
  if (level >= 75) return 'A';
  if (level >= 50) return 'B';
  if (level >= 25) return 'C';
  if (level >= 10) return 'D';
  return 'E';
};
