import { Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { LogOut, User, Swords, ShoppingCart, Trophy, Home } from 'lucide-react';
import { cn } from '../lib/utils';

export function Navbar() {
  const { profile } = useUserStore();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-black/50 backdrop-blur-md border-b border-white/10 z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">
          ASGARDVERSE
        </Link>

        {profile && (
          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-sm font-mono">
              <div className="flex items-center gap-1 text-yellow-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                {profile.coins} G
              </div>
              <div className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {profile.energy}/100 E
              </div>
              <div className="flex items-center gap-1 text-purple-400">
                Rank {profile.rank} (Lv.{profile.level})
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/" className="text-white/70 hover:text-white transition-colors"><Home size={20} /></Link>
              <Link to="/gacha" className="text-white/70 hover:text-white transition-colors"><Swords size={20} /></Link>
              <Link to="/market" className="text-white/70 hover:text-white transition-colors"><ShoppingCart size={20} /></Link>
              <Link to="/leaderboard" className="text-white/70 hover:text-white transition-colors"><Trophy size={20} /></Link>
              
              <div className="relative group">
                <button className="flex items-center gap-2">
                  <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} alt="Avatar" className="w-8 h-8 rounded-full border border-white/20" />
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-black/90 border border-white/10 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                  <div className="p-4 flex flex-col gap-2">
                    <p className="text-sm font-bold text-white truncate">{profile.displayName}</p>
                    <p className="text-xs text-white/50 truncate">{profile.email}</p>
                    <hr className="border-white/10 my-2" />
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors w-full text-left">
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
