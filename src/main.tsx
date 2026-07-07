
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './integration/store/memoryStore';
import { initTheme } from './theme/theme';

initTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);
