const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

class SimpleFrappeAPI {
  constructor(dbPath) {
    this.app = express();
    this.dbPath = dbPath;
    this.db = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Simple logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  connectDB() {
    if (!this.db) {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        console.log(`📊 Connected to database: ${this.dbPath}`);
      } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
      }
    }
    return this.db;
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const isConnected = this.db !== null;
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: isConnected ? 'connected' : 'disconnected',
        dbPath: this.dbPath
      });
    });

    // Get all tables
    this.app.get('/api/tables', (req, res) => {
      try {
        const db = this.connectDB();
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all();
        
        res.json({
          success: true,
          data: tables.map(t => t.name)
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to get tables');
      }
    });

    // Get table schema
    this.app.get('/api/schema/:tableName', (req, res) => {
      try {
        const { tableName } = req.params;
        const db = this.connectDB();
        
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        
        res.json({
          success: true,
          data: {
            tableName,
            columns: columns.map(col => ({
              name: col.name,
              type: col.type,
              notNull: col.notnull === 1,
              defaultValue: col.dflt_value,
              primaryKey: col.pk === 1
            }))
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to get table schema');
      }
    });

    // Get all records from a table
    this.app.get('/api/data/:tableName', (req, res) => {
      try {
        const { tableName } = req.params;
        const { limit = 100, offset = 0, orderBy, order = 'ASC' } = req.query;
        
        const db = this.connectDB();
        
        let query = `SELECT * FROM "${tableName}"`;
        const params = [];
        
        if (orderBy) {
          query += ` ORDER BY "${orderBy}" ${order.toUpperCase()}`;
        }
        
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const records = db.prepare(query).all(...params);
        
        // Get total count
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get();
        
        res.json({
          success: true,
          data: {
            records,
            total: countResult.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to get table data');
      }
    });

    // Get single record by ID or name
    this.app.get('/api/data/:tableName/:id', (req, res) => {
      try {
        const { tableName, id } = req.params;
        const db = this.connectDB();
        
        // Try to find by 'name' field first, then by rowid
        let record = null;
        
        try {
          record = db.prepare(`SELECT * FROM "${tableName}" WHERE name = ?`).get(id);
        } catch (e) {
          // If no 'name' column, try rowid
          record = db.prepare(`SELECT * FROM "${tableName}" WHERE rowid = ?`).get(id);
        }
        
        if (!record) {
          return res.status(404).json({
            error: 'Not Found',
            message: `Record with ID '${id}' not found in table '${tableName}'`
          });
        }
        
        res.json({
          success: true,
          data: record
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to get record');
      }
    });

    // Search records
    this.app.get('/api/search/:tableName', (req, res) => {
      try {
        const { tableName } = req.params;
        const { q, field = 'name', limit = 50 } = req.query;
        
        if (!q) {
          return res.status(400).json({
            error: 'Missing search query',
            message: 'Query parameter "q" is required'
          });
        }
        
        const db = this.connectDB();
        
        const query = `SELECT * FROM "${tableName}" WHERE "${field}" LIKE ? LIMIT ?`;
        const records = db.prepare(query).all(`%${q}%`, parseInt(limit));
        
        res.json({
          success: true,
          data: {
            query: q,
            field,
            records,
            count: records.length
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to search records');
      }
    });

    // Insert new record
    this.app.post('/api/data/:tableName', (req, res) => {
      try {
        const { tableName } = req.params;
        const data = req.body;
        
        if (!data || Object.keys(data).length === 0) {
          return res.status(400).json({
            error: 'No data provided',
            message: 'Request body must contain data to insert'
          });
        }
        
        const db = this.connectDB();
        
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        
        const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
        const result = db.prepare(query).run(...values);
        
        res.status(201).json({
          success: true,
          data: {
            id: result.lastInsertRowid,
            changes: result.changes,
            insertedData: data
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to insert record');
      }
    });

    // Update record
    this.app.put('/api/data/:tableName/:id', (req, res) => {
      try {
        const { tableName, id } = req.params;
        const data = req.body;
        
        if (!data || Object.keys(data).length === 0) {
          return res.status(400).json({
            error: 'No data provided',
            message: 'Request body must contain data to update'
          });
        }
        
        const db = this.connectDB();
        
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map(col => `"${col}" = ?`).join(', ');
        
        // Try to update by 'name' field first, then by rowid
        let query = `UPDATE "${tableName}" SET ${setClause} WHERE name = ?`;
        let result = db.prepare(query).run(...values, id);
        
        if (result.changes === 0) {
          // Try by rowid
          query = `UPDATE "${tableName}" SET ${setClause} WHERE rowid = ?`;
          result = db.prepare(query).run(...values, id);
        }
        
        if (result.changes === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: `Record with ID '${id}' not found in table '${tableName}'`
          });
        }
        
        res.json({
          success: true,
          data: {
            id,
            changes: result.changes,
            updatedData: data
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to update record');
      }
    });

    // Delete record
    this.app.delete('/api/data/:tableName/:id', (req, res) => {
      try {
        const { tableName, id } = req.params;
        const db = this.connectDB();
        
        // Try to delete by 'name' field first, then by rowid
        let query = `DELETE FROM "${tableName}" WHERE name = ?`;
        let result = db.prepare(query).run(id);
        
        if (result.changes === 0) {
          // Try by rowid
          query = `DELETE FROM "${tableName}" WHERE rowid = ?`;
          result = db.prepare(query).run(id);
        }
        
        if (result.changes === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: `Record with ID '${id}' not found in table '${tableName}'`
          });
        }
        
        res.json({
          success: true,
          data: {
            id,
            changes: result.changes,
            deleted: true
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to delete record');
      }
    });

    // Execute custom SQL query (SELECT only for safety)
    this.app.post('/api/query', (req, res) => {
      try {
        const { sql, params = [] } = req.body;
        
        if (!sql) {
          return res.status(400).json({
            error: 'No SQL query provided',
            message: 'Request body must contain "sql" field'
          });
        }
        
        // Only allow SELECT queries for safety
        const trimmedSql = sql.trim().toLowerCase();
        if (!trimmedSql.startsWith('select')) {
          return res.status(403).json({
            error: 'Query not allowed',
            message: 'Only SELECT queries are allowed'
          });
        }
        
        const db = this.connectDB();
        const result = db.prepare(sql).all(...params);
        
        res.json({
          success: true,
          data: {
            sql,
            params,
            results: result,
            count: result.length
          }
        });
      } catch (error) {
        this.handleError(res, error, 'Failed to execute query');
      }
    });

    //schemas
    // Frappe-style metadata for a table
this.app.get('/api/meta/:tableName', (req, res) => {
  try {
    const { tableName } = req.params;
    const db = this.connectDB();

    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();

    const mapSqliteTypeToFrappeType = (sqliteType) => {
      const type = (sqliteType || '').toLowerCase();
      if (type.includes('int')) return 'Int';
      if (type.includes('char') || type.includes('text')) return 'Data';
      if (type.includes('bool')) return 'Check';
      if (type.includes('real') || type.includes('floa') || type.includes('doub')) return 'Float';
      if (type.includes('date') || type.includes('time')) return 'Datetime';
      if (type.includes('blob')) return 'Attach';
      return 'Data'; // fallback
    };

    const fields = columns.map(col => ({
      fieldname: col.name,
      label: col.name,
      fieldtype: mapSqliteTypeToFrappeType(col.type),
      required: col.notnull === 1,
      default: col.dflt_value,
      primary_key: col.pk === 1
    }));

    res.json({
      success: true,
      data: {
        tableName,
        isSingle: tableName === 'SingleValue',
        fields
      }
    });
  } catch (error) {
    this.handleError(res, error, 'Failed to get table metadata');
  }
});
 //single lines 
 // Get all fields for a SingleValue document (like SystemSettings)
this.app.get('/api/single/:parent', (req, res) => {
  try {
    const { parent } = req.params;
    const db = this.connectDB();

    const rows = db.prepare(`
      SELECT fieldname, value FROM SingleValue WHERE parent = ?
    `).all(parent);

    const result = {};
    for (const row of rows) {
      result[row.fieldname] = row.value;
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    this.handleError(res, error, 'Failed to fetch SingleValue document');
  }
});


    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });
  }

  handleError(res, error, defaultMessage) {
    console.error(defaultMessage, error);
    res.status(500).json({
      error: error.name || 'Database Error',
      message: error.message || defaultMessage
    });
  }

  start(port = 3001) {
    try {
      this.connectDB();
      
      this.app.listen(port, () => {
        console.log(`🚀 Simple Frappe Books API running on port ${port}`);
        console.log(`📊 Database: ${this.dbPath}`);
        console.log(`🌐 Health check: http://localhost:${port}/health`);
        console.log(`📋 Tables: http://localhost:${port}/api/tables`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  stop() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }
}

// If running directly
if (require.main === module) {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'frappe-books.db');
  const port = parseInt(process.env.PORT || '3001');
  
  const api = new SimpleFrappeAPI(dbPath);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Server stopping...');
    api.stop();
    process.exit(0);
  });
  
  api.start(port);
}

module.exports = SimpleFrappeAPI;