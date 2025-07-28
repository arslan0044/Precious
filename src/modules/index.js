import express from "express";
import authRoutes from "./auth/routes.js";
import userRoutes from "./users/routes.js";
import conversationsRoutes from "./chat/routes.js";
const app = express();

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/conversations", conversationsRoutes);
export default app;
