import http from "http";
import os from "os";
import cluster from "cluster";
import { createTerminus } from "@godaddy/terminus";
import app from "./config/app.js";
import config from "./config/env.js";
import { disconnectMongoDB } from "./config/mongodb.js";
import { disconnectRedis } from "./config/redis.js";
import { logger } from "./config/logger.js";
// import { disconnectDB } from "./config/database.js";
import { initSocket } from "./socket/socket.js";

const PORT =  process.env.PORT || 10000; 
// Function to get network IP addresses
const getNetworkInfo = () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push({
          interface: interfaceName,
          address: iface.address,
        });
      }
    }
  }

  return addresses;
};
// ========================
// Start Server Function
// ========================
const startServer = async () => {
  try {
    const server = http.createServer(app);
    const io = initSocket(server);
    server.keepAliveTimeout = 120000; // 2 minutes
    server.headersTimeout = 120000;
    // ========================
    // Graceful Shutdown
    // ========================
    createTerminus(server, {
      signals: ["SIGINT", "SIGTERM"],
      timeout: 5000, // 5 seconds timeout for shutdown
      healthChecks: {
        "/server-health": async () => {
          return Promise.resolve({ status: "ok" });
        },
      },
      onSignal: async () => {
        logger.info("⚠️ Closing connections...");
        await Promise.all([
          // disconnectDB(),
          disconnectRedis(),
          disconnectMongoDB(),
        ]);
      },
      onShutdown: () => {
        logger.info("✅ Clean shutdown complete");
        return Promise.resolve();
      },
      logger: (msg, err) => {
        if (err) {
          logger.error("❌ Terminus error:", err);
        } else {
          logger.info(msg);
        }
      },
    });

    // ========================
    // Start Server
    // ========================
    server.listen(PORT, "0.0.0.0", () => {
      const networkInfo = getNetworkInfo();
      const localURL = `http://0.0.0.0:${PORT}`;
      const networkURLs = networkInfo
        .map((info) => `http://${info.address}:${PORT}`)
        .join("\n        ");

      console.log(`
        ################################################
        🚀 Server started successfully!
        
        🔌 Network Interfaces:
        ${networkInfo
          .map((info) => `- ${info.interface}: http://${info.address}:${PORT}`)
          .join("\n        ")}
        
        🌐 Access URLs:
        - Local: ${localURL}
        - Network: http://${networkInfo[0]?.address || "localhost"}:${PORT}/
        
        📚 API documentation: ${localURL}/api-docs
        🛰️  WebSocket Server: ws://${
          networkInfo[0]?.address || "localhost"
        }:${PORT}
        🌍 Environment: ${config.get("env")}
        🛠️  Worker PID: ${process.pid}
        ################################################
      `);

      logger.info(`
        ################################################
        Server running on:
        - Local: ${localURL}
        - Network: ${networkURLs}
        
        WebSocket Server: ws://${networkInfo[0]?.address || "localhost"}:${PORT}
        Environment: ${config.get("env")}
        Worker PID: ${process.pid}
        ################################################
      `);
    });

    return server;
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// ========================
// Clustering (Only for Production)
// ========================
if (config.get("env") === "production") {
  const numCPUs = os.cpus().length;

  if (cluster.isPrimary) {
    logger.info(`🟢 Primary process ${process.pid} is running`);

    // Fork workers for each CPU core
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Handle worker exit events
    cluster.on("exit", (worker) => {
      logger.error(`⚠️ Worker ${worker.process.pid} died`);
      cluster.fork(); // Restart the worker
    });
  } else {
    startServer(); // Start server in worker process
  }
} else {
  startServer(); // Start server in development mode
}
