import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAppCheck } from './services/firebaseApp';
import { initTheme } from './services/theme';

// Sync the in-memory theme with the value the inline script already applied.
initTheme();

// Register App Check before any Firebase call. Firebase AI Logic enforces it,
// so Gemini requests are rejected until this runs.
initAppCheck();

createRoot(document.getElementById('root')!).render(<App />);
