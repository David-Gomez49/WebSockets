const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// "Base de datos" en memoria para pizarras y temporizadores
const boards = {};
const deletionTimers = {};
// Tiempo de gracia para eliminar pizarras privadas vacías: 1 minuto (60 * 1000 ms)
const DELETION_DELAY = 60000;

// Servir los archivos estáticos de la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal que sirve el archivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Filtra y devuelve un objeto con las pizarras públicas y su información.
 * @returns {Object} Un objeto con las pizarras públicas.
 */
const getPublicBoards = () => {
    const publicBoards = {};
    for (const id in boards) {
        if (boards[id].isPublic) {
            publicBoards[id] = {
                name: boards[id].name,
                userCount: boards[id].users.size,
            };
        }
    }
    return publicBoards;
};

/**
 * Centraliza toda la lógica para cuando un usuario abandona una pizarra.
 * Se usa tanto al desconectarse como al hacer clic en "Salir".
 * @param {Socket} socket El socket del usuario que abandona la sala.
 */
const handleUserLeaving = (socket) => {
    const { boardId } = socket;
    // Asegurarse de que el usuario estaba realmente en una pizarra
    if (boardId && boards[boardId]) {
        const board = boards[boardId];
        board.users.delete(socket.id);
        socket.leave(boardId);

        console.log(`Usuario ${socket.id} ha salido de "${board.name}". Usuarios restantes: ${board.users.size}`);

        // Actualizar el contador de usuarios para los que quedan en la sala
        io.to(boardId).emit('update-user-count', board.users.size);

        // Comprobar si la pizarra se ha quedado vacía
        if (board.users.size === 0) {
            // Si es privada, programar su eliminación
            if (!board.isPublic) {
                console.log(`Pizarra privada "${board.name}" está vacía. Programando eliminación en ${DELETION_DELAY / 1000}s.`);
                deletionTimers[boardId] = setTimeout(() => {
                    // Volver a comprobar por si alguien se unió justo antes de la eliminación
                    if (boards[boardId] && boards[boardId].users.size === 0) {
                        console.log(`Eliminando pizarra privada vacía "${board.name}" (${board.id}) tras el periodo de gracia.`);
                        delete boards[boardId];
                    }
                    delete deletionTimers[boardId]; // Limpiar el registro del temporizador
                }, DELETION_DELAY);
            } else {
                // Si es pública, simplemente actualizar la lista para que aparezca con 0 usuarios
                console.log(`Pizarra pública "${board.name}" está vacía y permanecerá activa.`);
                io.emit('public-boards', getPublicBoards());
            }
        } else if (board.isPublic) {
            // Si aún quedan usuarios y es pública, actualizar la lista para reflejar el nuevo contador
            io.emit('public-boards', getPublicBoards());
        }
        
        socket.boardId = null; // Desvincular el ID de la pizarra del socket
    }
};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Enviar la lista de pizarras públicas al nuevo usuario
    socket.emit('public-boards', getPublicBoards());

    socket.on('create-board', ({ boardName, password }) => {
        const boardId = uuidv4();
        boards[boardId] = {
            id: boardId,
            name: boardName,
            password: password || null,
            isPublic: !password, // Una pizarra es pública si NO tiene contraseña
            history: [],
            users: new Set(),
        };

        const board = boards[boardId];
        
        // Unir al creador a la sala
        socket.join(boardId);
        socket.boardId = boardId;
        board.users.add(socket.id);

        // Enviar confirmación y datos de la pizarra al creador
        socket.emit('joined-board', {
            boardId: boardId,
            name: board.name,
            history: board.history
        });
        
        io.to(boardId).emit('update-user-count', board.users.size);

        // Si la nueva pizarra es pública, actualizar la lista para todos
        if (board.isPublic) {
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

        // Si el usuario ya está en otra sala, hacer que la abandone primero
        if (socket.boardId) {
            handleUserLeaving(socket);
        }

        // Si la pizarra estaba programada para eliminación, cancelar el temporizador
        if (deletionTimers[boardId]) {
            clearTimeout(deletionTimers[boardId]);
            delete deletionTimers[boardId];
            console.log(`Temporizador de eliminación cancelado para la pizarra "${board.name}".`);
        }
        
        socket.join(boardId);
        socket.boardId = boardId;
        board.users.add(socket.id);

        socket.emit('joined-board', { boardId, name: board.name, history: board.history });
        io.to(boardId).emit('update-user-count', board.users.size);

        if (board.isPublic) {
            io.emit('public-boards', getPublicBoards());
        }
    });
    
    // Evento para cuando el usuario hace clic en el botón "Salir"
    socket.on('leave-board', () => {
        handleUserLeaving(socket);
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

    // Evento para cuando el usuario se desconecta (cierra la pestaña, etc.)
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado por cierre: ${socket.id}`);
        handleUserLeaving(socket);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});