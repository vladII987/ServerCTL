import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  app.use(express.json());

  // Mock Data
  const servers = [
    { id: 'srv-01', name: 'web-prod-01', ip: '192.168.1.10', os: 'Ubuntu 22.04', status: 'online', cpu: 12, ram: 45, disk: 30, updates: 4, agentVersion: '1.2.0' },
    { id: 'srv-02', name: 'db-master', ip: '192.168.1.11', os: 'Debian 11', status: 'online', cpu: 8, ram: 72, disk: 65, updates: 0, agentVersion: '1.2.0' },
    { id: 'srv-03', name: 'backup-node', ip: '192.168.1.12', os: 'CentOS 7', status: 'offline', cpu: 0, ram: 0, disk: 0, updates: 12, agentVersion: '1.1.8' },
    { id: 'srv-04', name: 'win-ad-01', ip: '192.168.1.20', os: 'Windows Server 2022', status: 'online', cpu: 25, ram: 55, disk: 40, updates: 2, agentVersion: '1.2.0' },
    { id: 'srv-05', name: 'app-staging', ip: '192.168.1.30', os: 'Ubuntu 20.04', status: 'online', cpu: 45, ram: 30, disk: 15, updates: 25, agentVersion: '1.1.9' },
  ];

  // API Routes
  app.get("/api/servers", (req, res) => {
    res.json(servers);
  });

  app.get("/api/stats", (req, res) => {
    res.json({
      total: servers.length,
      online: servers.filter(s => s.status === 'online').length,
      updates: servers.reduce((acc, s) => acc + s.updates, 0),
      compliance: 85,
      osDistribution: [
        { name: 'Ubuntu', value: 2 },
        { name: 'Debian', value: 1 },
        { name: 'CentOS', value: 1 },
        { name: 'Windows', value: 1 },
      ]
    });
  });

  // Socket.io for "real-time" metrics
  io.on("connection", (socket) => {
    console.log("Client connected");
    
    const interval = setInterval(() => {
      const updatedServers = servers.map(s => ({
        ...s,
        cpu: s.status === 'online' ? Math.floor(Math.random() * 100) : 0,
        ram: s.status === 'online' ? Math.min(100, s.ram + (Math.random() * 4 - 2)) : 0,
      }));
      socket.emit("metrics", updatedServers);
    }, 2000);

    socket.on("disconnect", () => {
      clearInterval(interval);
      console.log("Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
