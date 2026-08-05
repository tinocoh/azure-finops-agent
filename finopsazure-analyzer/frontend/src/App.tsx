import { Navigate, Route, Routes } from './router';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AzureConfig from './pages/AzureConfig';
import RunAnalysis from './pages/RunAnalysis';
import Results from './pages/Results';
import Resources from './pages/Resources';
import Recommendations from './pages/Recommendations';
import Chat from './pages/Chat';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/config" element={<AzureConfig />} />
        <Route path="/run" element={<RunAnalysis />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/results/:runId" element={<Results />} />
        <Route path="/resources/:runId" element={<Resources />} />
        <Route path="/recommendations/:runId" element={<Recommendations />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
