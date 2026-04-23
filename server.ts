import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "memos.db");
const JSON_FILE = path.join(DATA_DIR, "entries.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR);
}

const db = new Database(DB_FILE);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    theme TEXT,
    status TEXT,
    note TEXT
  );
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    entry_id TEXT,
    text TEXT,
    description TEXT,
    progress INTEGER,
    images TEXT,
    FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );
`);

// Migration from JSON to SQLite if JSON exists and DB is empty
const migrate = async () => {
  const rowCount = db.prepare("SELECT count(*) as count FROM entries").get() as { count: number };
  if (rowCount.count === 0 && existsSync(JSON_FILE)) {
    try {
      const data = JSON.parse(await fs.readFile(JSON_FILE, "utf-8"));
      if (Array.isArray(data)) {
        const insertEntry = db.prepare("INSERT INTO entries (id, date, theme, status, note) VALUES (?, ?, ?, ?, ?)");
        const insertGoal = db.prepare("INSERT INTO goals (id, entry_id, text, description, progress, images) VALUES (?, ?, ?, ?, ?, ?)");
        
        const transaction = db.transaction((entries) => {
          for (const entry of entries) {
            insertEntry.run(entry.id, entry.date, entry.theme || null, entry.status, entry.note || null);
            for (const goal of entry.goals) {
              insertGoal.run(goal.id, entry.id, goal.text, goal.description || null, goal.progress, JSON.stringify(goal.images || []));
            }
          }
        });
        transaction(data);
        console.log("Migration from JSON to SQLite completed.");
      }
    } catch (e) {
      console.error("Migration failed:", e);
    }
  }
};

async function startServer() {
  await migrate();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Higher limit for base64 images

  // API to get entries
  app.get("/api/entries", (req, res) => {
    try {
      const entries = db.prepare("SELECT * FROM entries ORDER BY date DESC").all() as any[];
      const goals = db.prepare("SELECT * FROM goals").all() as any[];

      const combined = entries.map(entry => ({
        ...entry,
        goals: goals
          .filter(g => g.entry_id === entry.id)
          .map(g => ({
            ...g,
            images: JSON.parse(g.images || "[]")
          }))
      }));

      res.json(combined);
    } catch (error) {
      console.error("Fetch error:", error);
      res.json([]);
    }
  });

  // API to save entries (Bulk replacement for simplicity)
  app.post("/api/entries", (req, res) => {
    try {
      const entries = req.body;
      if (!Array.isArray(entries)) return res.status(400).json({ error: "Invalid data format" });

      const insertEntry = db.prepare("INSERT INTO entries (id, date, theme, status, note) VALUES (?, ?, ?, ?, ?)");
      const insertGoal = db.prepare("INSERT INTO goals (id, entry_id, text, description, progress, images) VALUES (?, ?, ?, ?, ?, ?)");

      const transaction = db.transaction((data) => {
        db.prepare("DELETE FROM goals").run();
        db.prepare("DELETE FROM entries").run();
        
        for (const entry of data) {
          insertEntry.run(entry.id, entry.date, entry.theme || null, entry.status, entry.note || null);
          if (entry.goals && Array.isArray(entry.goals)) {
            for (const goal of entry.goals) {
              insertGoal.run(goal.id, entry.id, goal.text, goal.description || null, goal.progress, JSON.stringify(goal.images || []));
            }
          }
        }
      });

      transaction(entries);
      res.json({ success: true });
    } catch (error) {
      console.error("Save error:", error);
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
