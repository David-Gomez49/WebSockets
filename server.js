const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// "Base de datos" en memoria
const boards = {};

app.use(express.static(path.join(__dirname, 'public')));

const { v4: uuidv4 } = require('uuid');

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Enviar la lista de pizarras públicas al cliente que acaba de conectar
    const getPublicBoards = () => {
        const publicBoards = {};
        for (const id in boards) {
            if (boards[id].isPublic) {
                publicBoards[id] = {
                    name: boards[id].name,
                    userCount: boards[id].users.size
                };
            }
        }
        return publicBoards;
    };
    socket.emit('public-boards', getPublicBoards());


    socket.on('create-board', ({ boardName, password }) => {
        const boardId = uuidv4();
        boards[boardId] = {
            name: boardName,
            password: password,
            isPublic: !password,
            history: [],
            users: new Set()
        };
        socket.emit('board-created', boardId);

        // Notificar a todos los clientes sobre la nueva pizarra pública
        if (boards[boardId].isPublic) {
            io.emit('public-boards', getPublicBoards());
        }
    });

    socket.on('join-board', ({ boardId, password }) => {
        const board = boards[boardId];
        if (!board) {
            return socket.emit('join-error', 'La pizarra no existe.');
        }

        if (board.password && board.password !== password) {
            return socket.emit('join-error', 'Contraseña incorrecta.');
        }

        socket.join(boardId);
        socket.boardId = boardId;

        board.users.add(socket.id);

        socket.emit('drawing-history', board.history);

        io.to(boardId).emit('update-user-count', board.users.size);

        // Confirmar al cliente que se ha unido
        socket.emit('joined-board', { boardId, name: board.name });

        // Actualizar el contador de usuarios en la lista pública
        if (board.isPublic) {
            io.emit('public-boards', getPublicBoards());
        }
    });

    socket.on('drawing', (data) => {
        const { boardId, ...drawingData } = data;
        if (boards[boardId]) {
            boards[boardId].history.push(drawingData);
            socket.to(boardId).emit('drawing', drawingData);
        }
    });

    socket.on('clear-board', (boardId) => {
        if (boards[boardId]) {
            boards[boardId].history = [];
            io.to(boardId).emit('board-cleared');
        }
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        const { boardId } = socket;
        if (boardId && boards[boardId]) {
            boards[boardId].users.delete(socket.id);
            // Actualizar el contador de usuarios para esa pizarra
            io.to(boardId).emit('update-user-count', boards[boardId].users.size);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});