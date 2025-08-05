import path from 'path';

const PORT = parseInt(process.env.PORT || '3001');
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'frappe-books.db');

console.log('🔧 Starting Frappe Books API Server...');
console.log(`📁 Database path: ${DB_PATH}`);
console.log(`🔌 Port: ${PORT}`);

const main = async () => {
  const { default: FrappeBooksAPI } = await import('./server.ts'); // 👈 NOTE: .js extension required for ESM

  const api = new FrappeBooksAPI(DB_PATH);

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n📤 Received ${signal}. Shutting down gracefully...`);
    try {
      await api.stop();
      console.log('✅ Server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Start the server
  await api.start(PORT).catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
};

main();