import mongoose from "mongoose";

// Retry forever until MongoDB is reachable. This makes pod start order
// irrelevant (e.g. backend booting before the mongodb pod is ready in k8s /
// docker-compose). Once connected, mongoose handles reconnects on its own.
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  for (let attempt = 1; ; attempt++) {
    try {
      const conn = await mongoose.connect(uri);
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.log(
        `MongoDB connection attempt ${attempt} failed: ${error.message}. Retrying in 5s...`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};
