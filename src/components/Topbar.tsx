import { useUserStore } from '../store/useUserStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { LogOut, Menu, Bell } from 'lucide-react';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile } = useUserStore();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-20 bg-black/50 backdrop-blur-md border-b border-white/5 z-30 transition-all duration-300">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="md:hidden p-2 text-white/50 hover:text-white transition-colors">
            <Menu size={24} />
          </button>
          
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white/50">
            <span className="text-purple-400">SYS_MSG:</span> Welcome to the Abyss.
          </div>
        </div>

        {profile && (
          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden sm:flex items-center gap-3 text-sm font-mono">
              {profile.activeBoosts?.double_coins && profile.activeBoosts.double_coins > new Date().toISOString() && (
                <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-lg border border-yellow-400/20" title="Double Coins Active">
                  <span className="text-xs font-black uppercase tracking-widest">2x G</span>
                </div>
              )}
              {profile.activeBoosts?.double_xp && profile.activeBoosts.double_xp > new Date().toISOString() && (
                <div className="flex items-center gap-2 text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-lg border border-purple-400/20" title="Double XP Active">
                  <span className="text-xs font-black uppercase tracking-widest">2x XP</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-lg border border-yellow-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                {profile.coins.toLocaleString()} G
              </div>
              <div className="flex items-center gap-2 text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-lg border border-purple-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                {profile.voidCrystals?.toLocaleString() || 0} VC
              </div>
              <div className="flex items-center gap-2 text-gray-400 bg-gray-400/10 px-3 py-1.5 rounded-lg border border-gray-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                {profile.abyssalDust?.toLocaleString() || 0} AD
              </div>
              <div className="flex items-center gap-2 text-cyan-400 bg-cyan-400/10 px-3 py-1.5 rounded-lg border border-cyan-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {profile.energy}/100 E
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative p-2 text-white/50 hover:text-white transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              
              <div className="relative group">
                <button className="flex items-center gap-3 pl-4 border-l border-white/10">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-white">{profile.nickname || profile.displayName}</p>
                    <p className="text-xs text-purple-400 font-mono">Rank {profile.rank}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-black text-xl border border-white/20 shrink-0">
                    {(profile.nickname || profile.displayName || '?').charAt(0).toUpperCase()}
                  </div>
                </button>
                
                <div className="absolute right-0 mt-4 w-56 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto overflow-hidden">
                  <div className="p-4 bg-white/5 border-b border-white/5 relative overflow-hidden">
                    {profile.profileBanner === 'abyssal_conqueror' && (
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-30 bg-red-900/50 mix-blend-overlay" />
                    )}
                    {profile.profileBanner === 'tournament_champion' && (
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 bg-yellow-900/50 mix-blend-overlay" />
                    )}
                    <div className="relative z-10">
                      <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                        {profile.nickname || profile.displayName}
                        {profile.profileBanner === 'abyssal_conqueror' && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Conqueror</span>}
                        {profile.profileBanner === 'tournament_champion' && <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Champion</span>}
                      </p>
                      <p className="text-xs text-white/50 truncate font-mono mt-1">{profile.email}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors w-full text-left font-bold">
                      <LogOut size={16} /> Disconnect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
