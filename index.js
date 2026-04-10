const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// 配置CORS
app.use(cors());
app.use(express.json());

// 检查环境变量
const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('Environment check:');
console.log('Database URL:', databaseUrl);
console.log('Auth Token:', authToken ? 'Present' : 'Missing');

if (!databaseUrl) {
  console.error('ERROR: TURSO_DATABASE_URL is not set');
  process.exit(1);
}

// 初始化Turso客户端
const db = createClient({
  url: databaseUrl,
  authToken: authToken
});

// 初始化数据库表
async function initDatabase() {
  try {
    console.log('Initializing database...');
    console.log('Database URL:', process.env.TURSO_DATABASE_URL);
    
    // 创建orders表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        senderAddress TEXT NOT NULL,
        senderName TEXT NOT NULL,
        senderPhone TEXT NOT NULL,
        receiverAddress TEXT NOT NULL,
        receiverName TEXT NOT NULL,
        receiverPhone TEXT NOT NULL,
        itemType TEXT NOT NULL,
        itemWeight INTEGER NOT NULL,
        price REAL NOT NULL,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    // 继续运行，即使数据库初始化失败
  }
}

// 初始化数据库
initDatabase();

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API路由
app.get('/api/orders', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM orders ORDER BY createdAt DESC');
    const orders = result.rows;
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    const id = generateId();
    const newOrder = {
      id,
      ...orderData,
      status: 'pending',
      createdAt: Date.now(),
      price: 15 + (orderData.itemWeight || 1) * 2
    };
    
    await db.execute(`
      INSERT INTO orders (id, senderAddress, senderName, senderPhone, receiverAddress, receiverName, receiverPhone, itemType, itemWeight, price, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newOrder.id,
      newOrder.senderAddress,
      newOrder.senderName,
      newOrder.senderPhone,
      newOrder.receiverAddress,
      newOrder.receiverName,
      newOrder.receiverPhone,
      newOrder.itemType,
      newOrder.itemWeight,
      newOrder.price,
      newOrder.status,
      newOrder.createdAt
    ]);
    
    res.status(200).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute('SELECT * FROM orders WHERE id = ?', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
    } else {
      res.status(200).json(result.rows[0]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 构建更新语句
    const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), id];
    
    await db.execute(`
      UPDATE orders SET ${updateFields} WHERE id = ?
    `, values);
    
    // 获取更新后的订单
    const result = await db.execute('SELECT * FROM orders WHERE id = ?', [id]);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM orders WHERE id = ?', [id]);
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// 健康检查
app.get('/health', async (req, res) => {
  try {
    // 测试数据库连接
    await db.execute('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check database error:', error);
    res.status(200).json({ status: 'ok', database: 'error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});