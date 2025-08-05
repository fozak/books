import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import DatabaseCore from '../backend/database/core';
import { SchemaMap, FieldValueMap } from '../schemas/types';
import { getSchemas } from '../schemas';

interface ApiRequest extends Request {
  db?: DatabaseCore;
}

interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
}

interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

class FrappeBooksAPI {
  private app: express.Application;
  private db: DatabaseCore;
  private schemaMap: SchemaMap;

  constructor(dbPath: string) {
    this.app = express();
    this.db = new DatabaseCore(dbPath);
    this.schemaMap = {};
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private async initializeSchemas(): Promise<void> {
    try {
      // Get schemas from Frappe Books
      this.schemaMap = getSchemas();
      this.db.setSchemaMap(this.schemaMap);
      console.log(`📋 Loaded ${Object.keys(this.schemaMap).length} schemas`);
    } catch (error) {
      console.error('Failed to load schemas:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // CORS middleware
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:8080',
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Database connection middleware
    this.app.use(async (req: ApiRequest, res: Response, next: NextFunction) => {
      try {
        if (!this.db.knex) {
          await this.db.connect();
        }
        req.db = this.db;
        next();
      } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({
          error: 'Database connection failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        } as ErrorResponse);
      }
    });

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: this.db.knex ? 'connected' : 'disconnected',
        schemasLoaded: Object.keys(this.schemaMap).length
      } as SuccessResponse);
    });

    // Get country code
    this.app.get('/api/country-code', async (req: Request, res: Response) => {
      try {
        const countryCode = await DatabaseCore.getCountryCode(this.db.dbPath);
        res.json({ 
          success: true, 
          data: { countryCode } 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to get country code');
      }
    });

    // Check if schema/document exists
    this.app.get('/api/exists/:schemaName/:name?', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName, name } = req.params;
        const exists = await req.db!.exists(schemaName, name);
        res.json({ 
          success: true, 
          data: { exists, schemaName, name } 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to check existence');
      }
    });

    // Get document by name
    this.app.get('/api/doc/:schemaName/:name?', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName, name } = req.params;
        const { fields } = req.query;
        
        let fieldsArray: string[] | undefined;
        if (fields) {
          fieldsArray = typeof fields === 'string' ? fields.split(',') : fields as string[];
        }

        const document = await req.db!.get(schemaName, name || '', fieldsArray);
        res.json({ 
          success: true, 
          data: document 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to get document');
      }
    });

    // Get all documents with filtering and pagination
    this.app.get('/api/list/:schemaName', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName } = req.params;
        const { 
          fields, 
          filters, 
          orderBy, 
          order = 'asc', 
          limit, 
          offset = 0,
          groupBy,
          start,
          end
        } = req.query;

        const options: any = {};

        if (fields) {
          options.fields = typeof fields === 'string' ? fields.split(',') : fields;
        }

        if (filters) {
          try {
            options.filters = typeof filters === 'string' ? JSON.parse(filters) : filters;
          } catch (e) {
            return res.status(400).json({
              error: 'Invalid filters format',
              message: 'Filters must be valid JSON'
            } as ErrorResponse);
          }
        }

        if (orderBy) {
          options.order = order === 'desc' ? 'desc' : 'asc';
          options.orderBy = orderBy as string;
        }

        if (limit) {
          options.limit = parseInt(limit as string);
        }

        if (offset) {
          options.offset = parseInt(offset as string);
        }

        if (groupBy) {
          options.groupBy = groupBy as string;
        }

        if (start !== undefined) {
          options.start = parseInt(start as string);
        }

        if (end !== undefined) {
          options.end = parseInt(end as string);
        }

        const documents = await req.db!.getAll(schemaName, options);
        res.json({ 
          success: true, 
          data: documents 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to get documents');
      }
    });

    // Insert new document
    this.app.post('/api/doc/:schemaName', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName } = req.params;
        const fieldValueMap: FieldValueMap = req.body;

        const insertedDocument = await req.db!.insert(schemaName, fieldValueMap);
        res.status(201).json({ 
          success: true, 
          data: insertedDocument 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to insert document');
      }
    });

    // Update existing document
    this.app.put('/api/doc/:schemaName/:name', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName, name } = req.params;
        const fieldValueMap: FieldValueMap = req.body;

        const updatedDocument = await req.db!.update(schemaName, fieldValueMap);
        res.json({ 
          success: true, 
          data: updatedDocument 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to update document');
      }
    });

    // Delete document
    this.app.delete('/api/doc/:schemaName/:name', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName, name } = req.params;
        await req.db!.delete(schemaName, name);
        res.json({ 
          success: true, 
          data: { deleted: true, schemaName, name } 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to delete document');
      }
    });

    // Rename document
    this.app.patch('/api/doc/:schemaName/:name/rename', async (req: ApiRequest, res: Response) => {
      try {
        const { schemaName, name } = req.params;
        const { newName } = req.body;

        if (!newName) {
          return res.status(400).json({
            error: 'Missing required parameter',
            message: 'newName is required'
          } as ErrorResponse);
        }

        await req.db!.rename(schemaName, name, newName);
        res.json({ 
          success: true, 
          data: { renamed: true, oldName: name, newName, schemaName } 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to rename document');
      }
    });

    // Execute raw SQL query (with caution)
    this.app.post('/api/raw-query', async (req: ApiRequest, res: Response) => {
      try {
        const { query, params = [] } = req.body;

        if (!query) {
          return res.status(400).json({
            error: 'Missing query',
            message: 'SQL query is required'
          } as ErrorResponse);
        }

        // Basic safety check - only allow SELECT queries for safety
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery.startsWith('select')) {
          return res.status(403).json({
            error: 'Query not allowed',
            message: 'Only SELECT queries are allowed via this endpoint'
          } as ErrorResponse);
        }

        const result = await req.db!.knex!.raw(query, params);
        res.json({ 
          success: true, 
          data: result 
        } as SuccussResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to execute query');
      }
    });

    // Get schema information
    this.app.get('/api/schema/:schemaName?', (req: Request, res: Response) => {
      try {
        const { schemaName } = req.params;
        
        if (schemaName) {
          const schema = this.schemaMap[schemaName];
          if (!schema) {
            return res.status(404).json({
              error: 'Schema not found',
              message: `Schema '${schemaName}' does not exist`
            } as ErrorResponse);
          }
          res.json({ 
            success: true, 
            data: schema 
          } as SuccessResponse);
        } else {
          res.json({ 
            success: true, 
            data: Object.keys(this.schemaMap) 
          } as SuccessResponse);
        }
      } catch (error) {
        this.handleError(res, error, 'Failed to get schema');
      }
    });

    // Migrate database
    this.app.post('/api/migrate', async (req: ApiRequest, res: Response) => {
      try {
        const config = req.body.config || {};
        await req.db!.migrate(config);
        res.json({ 
          success: true, 
          data: { migrated: true } 
        } as SuccessResponse);
      } catch (error) {
        this.handleError(res, error, 'Failed to migrate database');
      }
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
      } as ErrorResponse);
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } as ErrorResponse);
    });
  }

  private handleError(res: Response, error: any, defaultMessage: string): void {
    console.error(defaultMessage, error);
    
    const statusCode = error.statusCode || 500;
    const message = error.message || defaultMessage;
    
    res.status(statusCode).json({
      error: error.name || 'Database Error',
      message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    } as ErrorResponse);
  }

  public async start(port: number = 3001): Promise<void> {
    try {
      await this.initializeSchemas();
      await this.db.connect();
      
      this.app.listen(port, () => {
        console.log(`🚀 Frappe Books API server running on port ${port}`);
        console.log(`📊 Database: ${this.db.dbPath}`);
        console.log(`🌐 Health check: http://localhost:${port}/health`);
        console.log(`📖 API documentation: http://localhost:${port}/api/schema`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.db.close();
  }

  public getApp(): express.Application {
    return this.app;
  }
}

export default FrappeBooksAPI;