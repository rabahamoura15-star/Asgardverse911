import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/useUserStore';
import { MessageSquare, Send, Users, Shield, Crown } from 'lucide-react';
import { translations } from '../translations';
import { formatDistanceToNow } from 'date-fns';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Community() {
  const { profile, language } = useUserStore();
  const t = translations[language] as any;
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'global_chat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse();
      setMessages(msgs);
      setTimeout(() => scrollToBottom(), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'global_chat');
    });

    // Real Online Users Query
    const fetchOnlineCount = async () => {
      try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const onlineQuery = query(
          collection(db, 'users'),
          where('lastActive', '>=', fiveMinsAgo)
        );
        const snap = await getDocs(onlineQuery);
        setOnlineUsers(snap.size);
      } catch (e) {
        console.error("Failed to fetch online users", e);
      }
    };

    fetchOnlineCount();
    const onlineInterval = setInterval(fetchOnlineCount, 30000); // Every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(onlineInterval);
    };
  }, [profile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const topChatters = messages.reduce((acc: any, msg: any) => {
    if (!acc[msg.userId]) {
      acc[msg.userId] = {
        name: msg.userName,
        count: 0
      };
    }
    acc[msg.userId].count += 1;
    return acc;
  }, {});

  const sortedChatters = Object.values(topChatters)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newMessage.trim()) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'global_chat'), {
        text: msgText,
        userId: profile.uid,
        userName: profile.nickname || profile.displayName,
        userPhoto: profile.photoURL,
        userLevel: profile.level || 1,
        userRank: profile.rank || 'F',
        userBanner: profile.profileBanner || null,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-4">Access Denied</h2>
          <p className="text-white/50">You must enter the Abyss to view the global chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black/40 border border-white/10 rounded-2xl overflow-hidden relative h-[60vh] lg:h-auto">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-black uppercase tracking-widest text-white">Global Chat</h2>
              <p className="text-xs text-white/50 font-mono">Server 1 - The Abyss</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full shrink-0">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold text-green-400">{onlineUsers} Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/30 font-mono text-sm">
              No messages yet. Be the first to speak!
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = profile?.uid === msg.userId;
              const showAvatar = i === 0 || messages[i - 1].userId !== msg.userId;

              return (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="w-10 flex-shrink-0 flex flex-col items-center">
                    {showAvatar ? (
                      <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-black text-lg shrink-0 border-2 border-white/10">
                        {(msg.userName || '?').charAt(0).toUpperCase()}
                        {msg.userBanner === 'abyssal_conqueror' && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-red-900 shadow-lg transform rotate-12">
                            SS
                          </div>
                        )}
                        {msg.userBanner === 'tournament_champion' && (
                          <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-yellow-900 shadow-lg transform rotate-12">
                            CHAMP
                          </div>
                        )}
                      </div>
                    ) : <div className="w-10 h-10" />}
                  </div>
                  
                  <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {showAvatar && (
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className={`text-xs font-bold ${isMe ? 'text-cyan-400' : 'text-white/70'} flex items-center gap-1`}>
                          {msg.userName}
                          {msg.userBanner === 'abyssal_conqueror' && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-black tracking-widest uppercase border border-red-500/30">Conqueror</span>}
                          {msg.userBanner === 'tournament_champion' && <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded font-black tracking-widest uppercase border border-yellow-500/30">Champion</span>}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white/10 rounded text-white/50">
                          Lv.{msg.userLevel}
                        </span>
                        {msg.createdAt?.toDate && (
                          <span className="text-[10px] text-white/30">
                            {formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={`px-4 py-2 rounded-2xl text-sm ${
                      isMe 
                        ? 'bg-cyan-600 text-white rounded-tr-sm' 
                        : 'bg-white/10 text-white/90 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/50 backdrop-blur-md shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={profile ? "Type a message..." : "Log in to chat..."}
              disabled={!profile}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!profile || !newMessage.trim()}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Sidebar Info */}
      <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 pb-24 lg:pb-0">
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h3 className="font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
            <Shield className="text-purple-400 w-5 h-5" /> Server Rules
          </h3>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="flex gap-2"><span className="text-red-400">•</span> No spamming or flooding.</li>
            <li className="flex gap-2"><span className="text-red-400">•</span> Respect other hunters.</li>
            <li className="flex gap-2"><span className="text-red-400">•</span> No NSFW content.</li>
            <li className="flex gap-2"><span className="text-red-400">•</span> Trading is done in the Market.</li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/5 border border-yellow-500/30 rounded-2xl p-6 flex-1">
          <h3 className="font-black uppercase tracking-widest text-yellow-400 mb-2 flex items-center gap-2">
            <Crown className="w-5 h-5" /> Top Chatters
          </h3>
          <p className="text-xs text-white/50 mb-4">Engage in the community to earn special titles and rewards.</p>
          
          <div className="space-y-3">
            {sortedChatters.length > 0 ? (
              sortedChatters.map((chatter: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-[10px] font-bold text-yellow-500">{index + 1}</div>
                    <span className="text-sm font-bold text-white/80">{chatter.name}</span>
                  </div>
                  <span className="text-xs text-white/40 font-mono">{chatter.count} msgs</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-white/30 text-center py-4 font-mono">No chatters yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
