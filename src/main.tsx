import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAppCheck } from './services/firebaseApp';

// Register App Check before any Firebase call. Firebase AI Logic enforces it,
// so Gemini requests are rejected until this runs.
initAppCheck();

createRoot(document.getElementById('root')!).render(<App />);
