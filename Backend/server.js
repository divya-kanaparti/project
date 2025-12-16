import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import compression from "compression";
import { Pool } from "pg";
dotenv.config();

const app = express();
app.use(cors());
app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
});


app.use(compression());

// app.use(bodyParser.json());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));


/* ------------------ POSTGRESQL CONNECTION ------------------ */
// const pool = new Pool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT || 5432,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });



const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Create table if not exists
pool.connect()
  .then(client => {
    console.log("✅ PostgreSQL Connected!");

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255),
        json_data TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return client.query(createTableQuery)
      .then(() => {
        console.log("✅ Table 'uploaded_files' is ready!");
        client.release();
      });
  })
  .catch(err => console.error("❌ PostgreSQL Connection Error:", err));

/* -------------------------------------------------------
   UPLOAD JSON API
-------------------------------------------------------- */
// app.post("/upload-json", async (req, res) => {
//   const { file_name, json_data } = req.body;

//   if (!file_name || !json_data) {
//     return res.status(400).json({ message: "Invalid payload" });
//   }

//   try {
//     await pool.query(
//       "INSERT INTO uploaded_files (file_name, json_data) VALUES ($1, $2)",
//       [file_name, JSON.stringify(json_data)]
//       // [file_name,json_data]
//     );

//     res.json({ message: "Excel data saved successfully!" });
//   }catch (err) {
//   console.error("❌ DB Insert Error FULL:", err.message);
//   console.error(err.stack);
//   return res.status(500).json({
//     message: "Database insert failed",
//     error: err.message
//   });
// }
// });
//   } catch (err) {
//     console.error("❌ DB Insert Error:", err);
//     res.status(500).json({ message: "Database insert failed" });
//   }
// });

app.post("/upload-json", async (req, res) => {
  const { file_name, json_data } = req.body;

  if (!file_name || !json_data) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {
    await pool.query(
      "INSERT INTO uploaded_files (file_name, json_data) VALUES ($1, $2)",
      [file_name, JSON.stringify(json_data)]  // ✅ IMPORTANT
    );

    res.json({ message: "Excel data saved successfully!" });
  } catch (err) {
    console.error("❌ DB Insert Error:", err.message);
    res.status(500).json({ message: "Database insert failed" });
  }
});


/* -------------------------------------------------------
   HISTORY LIST API (SIDEBAR)
-------------------------------------------------------- */
app.get("/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, file_name, uploaded_at
      FROM uploaded_files
      ORDER BY uploaded_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ History Fetch Error:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
});

/* -------------------------------------------------------
   VIEW / DOWNLOAD A FILE BY ID  ✅ FIXED
-------------------------------------------------------- */
app.get("/history/:id", async (req, res) => {
  const fileId = req.params.id;

  try {
    const result = await pool.query(
      "SELECT file_name, json_data FROM uploaded_files WHERE id = $1",
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({
      file_name: result.rows[0].file_name,
      json_data: JSON.parse(result.rows[0].json_data)
    });

  } catch (err) {
    console.error("❌ File Load Error:", err);
    res.status(500).json({ message: "Failed to load file data" });
  }
});

/* -------------------------------------------------------
   START SERVER
-------------------------------------------------------- */
// app.listen(5000, () => {
//   console.log("🚀 Server running on port 5000");
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
