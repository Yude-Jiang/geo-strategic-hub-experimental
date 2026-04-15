import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Dynamic endpoint for runtime environment variables (Secret Manager)
// All VITE_ keys are injected here so Cloud Run / Aliyun SAE env vars
// take effect at runtime without requiring a rebuild.
app.get('/config.js', (req, res) => {
  const envVars = {
    VITE_GEMINI_API_KEY:   process.env.VITE_GEMINI_API_KEY   || '',
    VITE_DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY || '',
    VITE_QWEN_API_KEY:     process.env.VITE_QWEN_API_KEY     || '',
    VITE_DOUBAO_API_KEY:   process.env.VITE_DOUBAO_API_KEY   || '',
    VITE_Kimi_API_KEY:     process.env.VITE_Kimi_API_KEY     || '',
  };
  res.set('Content-Type', 'application/javascript');
  res.send(`window.env = ${JSON.stringify(envVars)};`);
});

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Support SPA routing (redirect all non-file requests to index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
