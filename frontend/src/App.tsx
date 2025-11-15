import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Upload } from './pages/Upload';
import { Staging } from './pages/Staging';
import { Datasets } from './pages/Datasets';
import { Retrieval } from './pages/Retrieval';
import { Media } from './pages/Media';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { MediaProcessing } from './pages/MediaProcessing';
import { JsonProcessing } from './pages/JsonProcessing';
import './index.css';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/staging" element={<Staging />} />
        <Route path="/datasets" element={<Datasets />} />
        <Route path="/retrieval" element={<Retrieval />} />
        <Route path="/media" element={<Media />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/media-processing/:stagingId" element={<MediaProcessing />} />
        <Route path="/json-processing/:stagingId" element={<JsonProcessing />} />
      </Routes>
    </Layout>
  );
}

export default App;
