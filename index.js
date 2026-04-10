const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// 配置CORS
app.use(cors());
app.use(express.json());

// 初始化Firebase Admin
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

// API路由
app.get('/api/orders', async (req, res) => {
  try {
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    const newOrder = {
      ...orderData,
      status: 'pending',
      createdAt: Date.now(),
      price: 15 + (orderData.itemWeight || 1) * 2
    };
    const docRef = await db.collection('orders').add(newOrder);
    res.status(200).json({ id: docRef.id, ...newOrder });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orderRef = db.collection('orders').doc(id);
    const doc = await orderRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Order not found' });
    } else {
      res.status(200).json({ id: doc.id, ...doc.data() });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const orderRef = db.collection('orders').doc(id);
    await orderRef.update(updateData);
    const doc = await orderRef.get();
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('orders').doc(id).delete();
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});