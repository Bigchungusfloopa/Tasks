import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { ensureSchema, pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === clientOrigin || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS.'));
    }
  })
);
app.use(express.json());

const serializeTodo = (row) => ({
  id: Number(row.id),
  title: row.title,
  notes: row.notes,
  dueAt: row.due_at,
  completed: row.completed,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const parseDueAt = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid due date.');
  }

  return date.toISOString();
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'Tasks API' });
});

app.get('/api/todos', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM todos
       ORDER BY completed ASC, due_at ASC NULLS LAST, created_at DESC`
    );
    res.json(rows.map(serializeTodo));
  } catch (error) {
    next(error);
  }
});

app.post('/api/todos', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const notes = String(req.body.notes || '').trim();
    const dueAt = parseDueAt(req.body.dueAt);

    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO todos (title, notes, due_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, notes, dueAt ?? null]
    );

    return res.status(201).json(serializeTodo(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/todos/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const title = req.body.title === undefined ? undefined : String(req.body.title).trim();
    const notes = req.body.notes === undefined ? undefined : String(req.body.notes).trim();
    const dueAt = parseDueAt(req.body.dueAt);
    const completed =
      req.body.completed === undefined ? undefined : Boolean(req.body.completed);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Invalid todo id.' });
    }

    if (title === '') {
      return res.status(400).json({ message: 'Title is required.' });
    }

    const { rows } = await pool.query(
      `UPDATE todos
       SET
        title = COALESCE($1, title),
        notes = COALESCE($2, notes),
        due_at = CASE WHEN $3::boolean THEN $4::timestamptz ELSE due_at END,
        completed = COALESCE($5, completed)
       WHERE id = $6
       RETURNING *`,
      [title, notes, dueAt !== undefined, dueAt, completed, id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Todo not found.' });
    }

    return res.json(serializeTodo(rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/todos/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Invalid todo id.' });
    }

    const result = await pool.query('DELETE FROM todos WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Todo not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.message === 'Invalid due date.') {
    res.status(400).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: 'Something went wrong.' });
});

ensureSchema()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Tasks API listening on http://localhost:${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing server or set PORT in server/.env.`);
        process.exit(1);
      }

      throw error;
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database schema.');
    console.error(error);
    process.exit(1);
  });
