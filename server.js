const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// "Base de datos" 
let drawingHistory = [];


app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);
    socket.emit('drawing-history', drawingHistory);

    // 2. Escuchar por eventos de dibujo de un cliente.
    socket.on('drawing', (data) => {
        console.log(data)
        drawingHistory.push(data);
        socket.broadcast.emit('drawing', data);
    });

    // 3. Escuchar por el evento de limpiar el tablero.
    socket.on('clear-board', () => {
        drawingHistory = [];
        io.emit('board-cleared');
    });

    // 4. Manejar la desconexión de un usuario.
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});