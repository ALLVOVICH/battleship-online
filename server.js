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
      turnIndex: 0,
      rematch: {}
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
    room.boards[socket.id] = ships.map(cells => ({
      cells,
      hits: []
    }));

    if (Object.keys(room.boards).length === 2) {
      const first = room.players[room.turnIndex % 2];
      io.to(first).emit("yourTurn");
      io.to(code).emit("gameStarted");
    }
  });

  socket.on("shot", ({ code, cell }) => {
    const room = rooms[code];
    const current = room.players[room.turnIndex % 2];
    if (socket.id !== current) return;

    const enemy = room.players.find(p => p !== socket.id);
    const fleet = room.boards[enemy];

    let hit = false;
    let destroyedShip = null;

    for (const ship of fleet) {
      if (ship.cells.includes(cell) && !ship.hits.includes(cell)) {
        ship.hits.push(cell);
        hit = true;
        if (ship.hits.length === ship.cells.length) {
          destroyedShip = ship.cells;
        }
        break;
      }
    }

    socket.emit("shotResult", { cell, hit, destroyedShip });
    socket.to(code).emit("enemyShot", { cell, hit });

    const allDestroyed = fleet.every(s => s.hits.length === s.cells.length);
    if (allDestroyed) {
      socket.emit("win");
      io.to(enemy).emit("lose");
      return;
    }

    if (!hit) {
      room.turnIndex++;
      const next = room.players[room.turnIndex % 2];
      io.to(next).emit("yourTurn");
      io.to(code).emit("enemyTurn", next);
    }
  });

  socket.on("rematch", code => {
    const room = rooms[code];
    room.rematch[socket.id] = true;

    if (Object.keys(room.rematch).length === 2) {
      room.boards = {};
      room.rematch = {};
      room.turnIndex++;
      io.to(code).emit("startPlacement");
    }
  });
});

server.listen(process.env.PORT || 3000);
