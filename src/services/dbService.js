import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clickbot',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL conectado');
    return true;
  } catch (err) {
    console.warn('Aviso: MySQL não disponível ->', err.message);
    return false;
  }
}
