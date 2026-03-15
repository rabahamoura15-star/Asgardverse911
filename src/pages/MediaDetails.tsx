import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMediaDetails } from '../services/api';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Play, BookOpen, Languages, Youtube, Sparkles } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { translations } from '../translations';
import { GoogleGenAI } from "@google/genai";
import { InterstitialAd } from '../components/InterstitialAd';

import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export function MediaDetails() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { profile, language, trackAction } = useUserStore();
  const t = translations[language] as any;
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [trailerWatched, setTrailerWatched] = useState(false);
  const [territory, setTerritory] = useState<any>(null);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [isApologyOpen, setIsApologyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { updateMediaInteraction } = useUserStore();

  const { data: media, isLoading } = useQuery({
    queryKey: ['mediaDetails', type, id],
    queryFn: () => getMediaDetails(Number(id), type as string),
    enabled: !!id && !!type,
  });

  useEffect(() => {
    const fetchTerritory = async () => {
      if (!id) return;
      try {
        const territoryRef = doc(db, 'territories', id.toString());
        const snap = await getDoc(territoryRef);
        if (snap.exists()) {
          setTerritory(snap.data());
        }
      } catch (e) {
        console.error("Failed to fetch territory", e);
      }
    };
    
    fetchTerritory();
  }, [id, profile?.uid]);

  useEffect(() => {
    if (media) {
      trackAction('view');
      if (media.countryOfOrigin === 'KR') {
        trackAction('manhwa');
      }
    }
  }, [media?.id]);

  const handleAdClose = () => {
    setIsAdOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const checkCooldown = () => {
    if (!profile || !id) return true; // Default to showing ad if no profile
    const lastInteraction = profile.mediaLastInteraction?.[id];
    if (!lastInteraction) return true;

    const lastDate = new Date(lastInteraction);
    const now = new Date();
    const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= 12;
  };

  const triggerActionWithAd = (action: () => void) => {
    if (checkCooldown()) {
      setPendingAction(() => async () => {
        if (id) await updateMediaInteraction(id);
        action();
      });
      setIsApologyOpen(true);
    } else {
      action();
    }
  };

  const handleTrailerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!media?.trailer?.id) return;

    const action = () => {
      if (!trailerWatched) {
        trackAction('trailer');
        setTrailerWatched(true);
      }
    };

    triggerActionWithAd(action);
  };

  const handleReadNowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!media) return;
    
    const title = media.title.english || media.title.romaji || media.title.native;
    const isAnime = type === 'ANIME';
    const suffix = isAnime ? (t.episodeOne || 'Episode 1') : (t.chapterOne || 'Chapter 1');
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${title} ${suffix}`)}`;

    const action = () => {
      window.open(searchUrl, '_blank');
    };

    triggerActionWithAd(action);
  };

  useEffect(() => {
    const translateDescription = async () => {
      if (!media?.description || language === 'en') {
        setTranslatedDescription(null);
        return;
      }

      setIsTranslating(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Translate the following anime/manga description into ${language}. Keep the HTML tags if any. Only return the translated text. Description: ${media.description}`,
        });
        setTranslatedDescription(response.text || null);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedDescription(null);
      } finally {
        setIsTranslating(false);
      }
    };

    translateDescription();
  }, [media?.description, language]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!media) return <div className="text-center py-20">Media not found</div>;

  const title = media.title.english || media.title.romaji || media.title.native;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="fixed top-24 left-4 z-[100] bg-black/50 backdrop-blur-md p-3 rounded-full border border-white/10 hover:bg-black/80 transition-all group"
      >
        <ArrowLeft className="w-6 h-6 text-white group-hover:-translate-x-1 transition-transform" />
      </button>

      {/* Banner */}
      <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden mb-8 border border-white/10">
        {media.bannerImage ? (
          <img src={media.bannerImage} alt="Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-purple-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent" />
      </div>

      <div className="flex flex-col md:flex-row gap-8 px-4 -mt-32 relative z-10">
        {/* Cover Image */}
        <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
          {(media.coverImage.extraLarge || media.coverImage.large) ? (
            <img 
              src={media.coverImage.extraLarge || media.coverImage.large} 
              alt={title}
              className="w-full rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full aspect-[2/3] bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
              <Sparkles className="text-white/20 w-16 h-16" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 pt-4 md:pt-32">
          <h1 className="text-4xl md:text-5xl font-black mb-2">{title}</h1>
          
          {territory && territory.controllingGuildName && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl mb-6">
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Controlled By</span>
              <span className="text-sm font-black text-white">{territory.controllingGuildName}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm font-mono">
            <div className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
              <Star size={16} /> {media.averageScore ? media.averageScore / 10 : 'N/A'}
            </div>
            <div className="px-3 py-1 rounded-full border border-white/20 bg-white/5 uppercase">
              {media.status}
            </div>
            {media.episodes && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
                <Play size={16} /> {media.episodes} Episodes
              </div>
            )}
            {media.chapters && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-full border border-purple-400/20 bg-purple-400/10 text-purple-400">
                <BookOpen size={16} /> {media.chapters} Chapters
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {media.genres.map((g: string) => (
              <span key={g} className="text-xs font-bold px-2 py-1 bg-white/10 rounded text-white/70">
                {g}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2 mb-8">
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={handleReadNowClick}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] hover:-translate-y-1"
              >
                {type === 'ANIME' ? <Play size={20} /> : <BookOpen size={20} />}
                {type === 'ANIME' ? (t.watchNow || 'Watch Now') : (t.readNow || 'Read Now')}
              </button>
              
              {type === 'ANIME' && (
                <a 
                  href={`https://crunchyroll.com/search?q=${encodeURIComponent(title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(234,88,12,0.4)] hover:shadow-[0_0_30px_rgba(234,88,12,0.6)] hover:-translate-y-1"
                >
                  <Play size={20} /> Watch on Crunchyroll
                </a>
              )}
            </div>
            <p className="text-xs text-white/50 italic max-w-md">
              {t.readNowDesc || "Support us by clicking 'Read Now'. An ad will appear, and you will be redirected to read the manga."}
            </p>
          </div>

          <div className="relative">
            {isTranslating && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
                <div className="flex items-center gap-2 text-purple-400 font-bold animate-pulse">
                  <Languages size={16} /> Translating...
                </div>
              </div>
            )}
            <div 
              className="text-white/70 leading-relaxed text-sm md:text-base"
              dangerouslySetInnerHTML={{ __html: translatedDescription || media.description || 'No description available.' }}
            />
          </div>
        </div>
      </div>

      {/* Trailer */}
      {media.trailer && media.trailer.site === 'youtube' && (
        <div className="mt-16 px-4">
          <h2 className="text-2xl font-black tracking-widest uppercase mb-6 border-l-4 border-red-500 pl-4 flex items-center gap-2">
            <Youtube className="text-red-500" /> Watch Trailer
          </h2>
          {!trailerWatched ? (
            <div 
              onClick={handleTrailerClick}
              className="aspect-video w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 flex flex-col items-center justify-center cursor-pointer group relative"
            >
              <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                {media.trailer.id ? (
                  <img src={`https://img.youtube.com/vi/${media.trailer.id}/maxresdefault.jpg`} alt="" className="w-full h-full object-cover blur-sm" />
                ) : (
                  <div className="w-full h-full bg-red-900/20 blur-sm" />
                )}
              </div>
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)] group-hover:scale-110 transition-transform">
                  <Play size={40} fill="white" className="ml-2" />
                </div>
                <span className="text-xl font-black uppercase tracking-[0.2em] text-white/80">Play Trailer</span>
              </div>
            </div>
          ) : (
            <div className="aspect-video w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <iframe
                src={`https://www.youtube.com/embed/${media.trailer.id}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          )}
        </div>
      )}

      {/* Characters */}
      {media.characters.edges.length > 0 && (
        <div className="mt-16 px-4">
          <h2 className="text-2xl font-black tracking-widest uppercase mb-6 border-l-4 border-purple-500 pl-4">{t.characters}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {media.characters.edges.map((edge: any) => (
              <div key={edge.node.id} className="bg-white/5 rounded-xl overflow-hidden border border-white/10 group">
                <div className="aspect-[3/4] overflow-hidden">
                  <img 
                    src={edge.node.image.large} 
                    alt={edge.node.name.full}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm truncate">{edge.node.name.full}</h3>
                  <p className="text-xs text-purple-400 uppercase tracking-wider mt-1">{edge.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {media.recommendations.nodes.length > 0 && (
        <div className="mt-16 px-4">
          <h2 className="text-2xl font-black tracking-widest uppercase mb-6 border-l-4 border-cyan-400 pl-4">{t.ifYouLiked}</h2>
          <div className="flex gap-4 overflow-x-auto pb-6 snap-x no-scrollbar">
            {media.recommendations.nodes.map((node: any) => {
              const rec = node.mediaRecommendation;
              if (!rec) return null;
              return (
                <motion.div 
                  key={rec.id}
                  whileHover={{ y: -5 }}
                  onClick={() => navigate(`/media/${rec.type.toLowerCase()}/${rec.id}`)}
                  className="min-w-[160px] w-[160px] snap-start cursor-pointer group"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 border border-white/10 relative">
                    <img 
                      src={rec.coverImage.large} 
                      alt={rec.title.english || rec.title.romaji}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded text-xs font-mono font-bold border border-white/10 text-yellow-400">
                      ★ {rec.averageScore ? rec.averageScore / 10 : '?'}
                    </div>
                  </div>
                  <h3 className="font-bold text-sm line-clamp-2 text-white/80 group-hover:text-white transition-colors">
                    {rec.title.english || rec.title.romaji}
                  </h3>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ad Apology Modal */}
      {isApologyOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl max-w-md w-full text-center"
          >
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-widest mb-4">{t.adApologyTitle}</h3>
            <p className="text-white/70 mb-8 leading-relaxed">
              {t.adApologyMessage}
            </p>
            <button
              onClick={() => {
                setIsApologyOpen(false);
                setIsAdOpen(true);
              }}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest rounded-xl transition-all"
            >
              {t.continueToWork}
            </button>
          </motion.div>
        </div>
      )}

      <InterstitialAd isOpen={isAdOpen} onClose={handleAdClose} />
    </div>
  );
}
