const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = [];

io.on("connection", socket => {
  players.push(socket.id);

  socket.emit("player", players.length);

  socket.on("move", data => {
    socket.broadcast.emit("move", data);
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p !== socket.id);
  });
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
