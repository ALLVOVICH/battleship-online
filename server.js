const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {}; 
// rooms[code] = { players: [socketId], ships: {id: count}, turn: socketId }

io.on("connection", socket => {

  socket.on("join", code => {
    if (!rooms[code]) {
      rooms[code] = { players: [], ships: {}, turn: null };
    }

    const room = rooms[code];
    if (room.players.length >= 2) {
      socket.emit("full");
      return;
    }

    room.players.push(socket.id);
    room.ships[socket.id] = 20; // всего палуб
    socket.join(code);

    socket.emit("player", room.players.length);

    if (room.players.length === 2) {
      room.turn = room.players[0];
      io.to(code).emit("start", room.turn);
    }
  });

  socket.on("move", ({ code, x, y }) => {
    const room = rooms[code];
    if (!room || room.turn !== socket.id) return;

    socket.to(code).emit("enemyMove", { x, y });
  });

  socket.on("result", ({ code, hit }) => {
    const room = rooms[code];
    const enemy = room.play
