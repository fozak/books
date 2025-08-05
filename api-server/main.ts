import path from 'path';
const { default: FrappeBooksAPI } = await import('./server.js');

const PORT = parseInt(process.env.PORT || '3001', 10);
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'frappe-books.db');

const main = async () => {
  const api = new FrappeBooksAPI(DB_PATH);

  // Graceful shutdown handler
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

  process.on('uncaughtException', (error: unknown) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Start the server
  try {
    await api.start(PORT);
    console.log(`🚀 Server is running on port ${PORT}`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

main();
