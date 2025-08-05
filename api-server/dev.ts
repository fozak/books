import path from 'path';
import FrappeBooksAPI from './server.js';

const PORT = 3001;
const DB_PATH = path.join(process.cwd(), 'frappe-books-dev.db');

console.log('🔧 Starting Frappe Books API Server (Development Mode)...');
console.log(`📁 Database path: ${DB_PATH}`);
console.log(`🔌 Port: ${PORT}`);
console.log('🐛 Debug mode enabled');

const api = new FrappeBooksAPI(DB_PATH);

process.on('SIGINT', async () => {
  console.log('\n🛑 Development server stopping...');
  await api.stop();
  process.exit(0);
});

await api.start(PORT);
