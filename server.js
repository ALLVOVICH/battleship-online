const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static("public"))

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html")
})

const rooms = {}

io.on("connection", socket => {
  console.log("Connected:", socket.id)

  socket.on("join-room", roomCode => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        turn: 0,
        boards: {},
        ready: {}
      }
    }

    const room = rooms[roomCode]
    if (room.players.length >= 2) return

    room.players.push(socket.id)
    socket.join(roomCode)

    console.log(`Player joined room ${roomCode}`)

    socket.emit("joined", room.players.length)

    if (room.players.length === 2) {
      room.players.forEach((id, i) => {
        io.to(id).emit("start-game", {
          yourTurn: i === 0
        })
      })
    }
  })

  socket.on("place-ships", ({ roomCode, board }) => {
    rooms[roomCode].boards[socket.id] = board
    rooms[roomCode].ready[socket.id] = true

    const room = rooms[roomCode]
    if (Object.keys(room.ready).length === 2) {
      room.players.forEach(id => {
        io.to(id).emit("both-ready")
      })
    }
  })

  socket.on("shoot", ({ roomCode, x, y }) => {
    const room = rooms[roomCode]
    const playerIndex = room.players.indexOf(socket.id)

    if (playerIndex !== room.turn) return

    const enemyId = room.players[1 - playerIndex]
    const enemyBoard = room.boards[enemyId]
    const cell = enemyBoard[y][x]

    if (cell.hit) return

    cell.hit = true

    const hit = cell.ship
    const sunk = hit && checkSunk(enemyBoard, cell.shipId)

    io.to(socket.id).emit("shot-result", { x, y, hit, sunk })
    io.to(enemyId).emit("enemy-shot", { x, y, hit, sunk })

    if (!hit) {
      room.turn = 1 - room.turn
    }

    if (checkWin(enemyBoard)) {
      io.to(socket.id).emit("victory")
      io.to(enemyId).emit("defeat")
    }
  })

  socket.on("rematch", roomCode => {
    const room = rooms[roomCode]
    room.turn = 0
    room.boards = {}
    room.ready = {}

    room.players.forEach((id, i) => {
      io.to(id).emit("rematch-start", { yourTurn: i === 0 })
    })
  })

  socket.on("disconnect", () => {
    for (const code in rooms) {
      rooms[code].players = rooms[code].players.filter(id => id !== socket.id)
      if (rooms[code].players.length === 0) delete rooms[code]
    }
  })
})

function checkSunk(board, shipId) {
  for (let row of board) {
    for (let cell of row) {
      if (cell.shipId === shipId && !cell.hit) return false
    }
  }
  return true
}

function checkWin(board) {
  for (let row of board) {
    for (let cell of row) {
      if (cell.ship && !cell.hit) return false
    }
  }
  return true
}

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log("Server running on", PORT))
