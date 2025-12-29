const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", socket => {

  socket.on("createRoom", () => {
    const code = genCode();
    rooms[code] = {
      players: [socket.id],
      boards: {},
      turn: null,
      ready: {}
    };
    socket.join(code);
    socket.emit("roomCode", code);
  });

  socket.on("joinRoom", code => {
    const room = rooms[code];
    if (!room || room.players.length >= 2) return;

    room.players.push(socket.id);
    socket.join(code);
    io.to(code).emit("startPlacement");
  });

  socket.on("setBoard", ({ code, ships }) => {
    const room = rooms[code];
    room.boards[socket.id] = {
      ships: new Set(ships),
      hits: new Set(),
      alive: ships.length
    };

    if (Object.keys(room.boards).length === 2) {
      room.turn = room.players[0];
      io.to(room.turn).emit("yourTurn");
    }
  });

  socket.on("shot", ({ code, cell }) => {
    const room = rooms[code];
    if (room.turn !== socket.id) return;

    const enemy = room.players.find(p => p !== socket.id);
    const board = room.boards[enemy];

    let hit = false;

    if (board.ships.has(cell) && !board.hits.has(cell)) {
      hit = true;
      board.hits.add(cell);
      board.alive--;
    }

    socket.emit("shotResult", { cell, hit });
    socket.to(code).emit("enemyShot", { cell, hit });

    if (board.alive === 0) {
      io.to(socket.id).emit("win");
      io.to(enemy).emit("lose");
      return;
    }

    if (!hit) room.turn = enemy;
    io.to(room.turn).emit("yourTurn");
  });

  socket.on("rematch", code => {
    const room = rooms[code];
    room.ready[socket.id] = true;

    if (Object.keys(room.ready).length === 2) {
      room.boards = {};
      room.ready = {};
      room.turn = room.players[0];
      io.to(code).emit("restart");
    }
  });
});

server.listen(process.env.PORT || 3000);
