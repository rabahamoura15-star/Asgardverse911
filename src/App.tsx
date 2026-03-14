import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Gacha } from './pages/Gacha';
import { Leaderboard } from './pages/Leaderboard';
import { Market } from './pages/Market';
import { Quests } from './pages/Quests';
import { MediaDetails } from './pages/MediaDetails';
import { Inventory } from './pages/Inventory';
import { Guilds } from './pages/Guilds';
import { Community } from './pages/Community';
import { Gates } from './pages/Gates';
import { Arena } from './pages/Arena';
import { useUserStore } from './store/useUserStore';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 2,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useUserStore();
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  
  if (!profile) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gacha" element={<ProtectedRoute><Gacha /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
              <Route path="/market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
              <Route path="/quests" element={<ProtectedRoute><Quests /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
              <Route path="/guilds" element={<ProtectedRoute><Guilds /></ProtectedRoute>} />
              <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
              <Route path="/gates" element={<ProtectedRoute><Gates /></ProtectedRoute>} />
              <Route path="/arena" element={<ProtectedRoute><Arena /></ProtectedRoute>} />
              <Route path="/media/:type/:id" element={<MediaDetails />} />
            </Routes>
          </Layout>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
