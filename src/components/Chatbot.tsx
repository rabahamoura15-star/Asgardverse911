import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: 'مرحباً بك في ASGARDVERSE! أنا مساعدك الذكي. كيف يمكنني مساعدتك في عالم الأنمي والمانجا اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `User: ${userText}`,
        config: {
          systemInstruction: 'أنت مساعد ذكي في موقع ASGARDVERSE، موقع احترافي للأنمي، المانجا، والمانهوا. تحدث باللغة العربية بأسلوب احترافي ومحمس (مثل نظام الألعاب/الأنمي). أجب باختصار ومفيدة.',
        }
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: 'عذراً، حدث خطأ في الاتصال بالنظام.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400/50"
      >
        <MessageSquare className="text-white w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 z-50 w-80 sm:w-96 h-[500px] bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-purple-900/50 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot className="text-purple-400" />
                <h3 className="font-bold text-white">ASGARD AI</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar" dir="rtl">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-3 ${
                    msg.role === 'user' 
                      ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50 rounded-tr-none' 
                      : 'bg-purple-600/20 border border-purple-500/30 text-purple-50 rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-2 mb-1 opacity-50 text-xs">
                      {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                      <span>{msg.role === 'user' ? 'أنت' : 'ASGARD AI'}</span>
                    </div>
                    <div className="text-sm leading-relaxed prose prose-invert prose-p:my-1 prose-a:text-cyan-400">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-end" dir="rtl">
                  <div className="bg-purple-600/20 border border-purple-500/30 rounded-2xl rounded-tl-none p-3 flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10 bg-black/50" dir="rtl">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="اسألني عن أي شيء..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors text-white placeholder-white/30"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 rounded-xl transition-colors text-white"
                >
                  <Send size={20} className="rotate-180" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
