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
    
    // NOTIFICAR A TODOS SOBRE EL NUEVO NÚMERO DE USUARIOS
    io.emit('update-user-count', io.engine.clientsCount);

    socket.emit('drawing-history', drawingHistory);

    socket.on('drawing', (data) => {
        drawingHistory.push(data);
        socket.broadcast.emit('drawing', data);
    });

    socket.on('clear-board', () => {
        drawingHistory = [];
        io.emit('board-cleared');
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        // NOTIFICAR A TODOS SOBRE EL NUEVO NÚMERO DE USUARIOS
        io.emit('update-user-count', io.engine.clientsCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});