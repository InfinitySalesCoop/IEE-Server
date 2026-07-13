const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const ADMIN_KEY  = process.env.ADMIN_KEY || 'IEE2025';

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Explicit CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-admin-key']
}));
app.options('*', cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.params.folder || 'db';
    const dir = path.join(UPLOAD_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Decode and sanitize
    const orig = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safe = orig.replace(/[^\w.\-äöüÄÖÜß ]/g, '_');
    cb(null, safe);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/files/:folder', (req, res) => {
  const dir = path.join(UPLOAD_DIR, req.params.folder);
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).map(name => {
    const stat = fs.statSync(path.join(dir, name));
    return { name, size: stat.size, modified: stat.mtime };
  });
  res.json(files);
});

app.get('/file/:folder/:name', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.folder, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filePath);
});

app.post('/upload/:folder', requireAdmin, upload.array('files', 50), (req, res) => {
  const uploaded = req.files.map(f => ({ name: f.filename, size: f.size }));
  res.json({ ok: true, files: uploaded });
});

app.delete('/file/:folder/:name', requireAdmin, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.folder, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

app.get('/', (req, res) => res.json({ status: 'IEE Solar GmbH File Server', ok: true }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
