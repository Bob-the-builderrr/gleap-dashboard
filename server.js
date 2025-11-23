import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import openTicketsHandler from './api/open-tickets.js';
import archivedTicketsHandler from './api/archived-tickets.js';
import teamPerformanceHandler from './api/team-performance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
// Wrap handlers to ensure they work with Express (req, res)
// Vercel handlers are (req, res), Express handlers are (req, res). Compatible.

app.get('/api/open-tickets', async (req, res) => {
    try {
        await openTicketsHandler(req, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/archived-tickets', async (req, res) => {
    try {
        await archivedTicketsHandler(req, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/team-performance', async (req, res) => {
    try {
        await teamPerformanceHandler(req, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
