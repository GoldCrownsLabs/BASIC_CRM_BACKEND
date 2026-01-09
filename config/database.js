const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🌐 Connecting to MongoDB Atlas Cloud...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Connection events
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to Atlas');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ Mongoose disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Failed: ${error.message}`);
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
