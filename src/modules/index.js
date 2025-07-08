import express from "express";
import authRoutes from "./auth/routes.js";
import userRoutes from "./users/routes.js";
const app = express();

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
export default app;
