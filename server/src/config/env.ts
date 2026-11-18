import 'dotenv/config';
export const env = { port: Number(process.env.PORT || 4000), nodeEnv: process.env.NODE_ENV || 'development', databaseUrl: process.env.DATABASE_URL, jwtSecret: process.env.JWT_SECRET || 'development-only-change-me', clientUrl: process.env.CLIENT_URL || 'http://localhost:5173', uploadDir: process.env.UPLOAD_DIR || 'uploads' };
