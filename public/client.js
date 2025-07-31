document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- ELEMENTOS DEL DOM ---
    const lobbyContainer = document.getElementById('lobby-container');
    const appContainer = document.querySelector('.app-container');
    const boardNameDisplay = document.getElementById('board-name-display');

    // Lobby
    const publicBoardsList = document.getElementById('public-boards-list');
    const createBoardBtn = document.getElementById('create-board-btn');
    const newBoardNameInput = document.getElementById('new-board-name');
    const newBoardPasswordInput = document.getElementById('new-board-password');
    const joinBoardBtn = document.getElementById('join-board-btn');
    const joinBoardIdInput = document.getElementById('join-board-id');
    const joinBoardPasswordInput = document.getElementById('join-board-password');

    // App
    const canvas = document.getElementById('whiteboard');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const colorPalette = document.querySelectorAll('.palette-color');
    const lineWidthInput = document.getElementById('lineWidth');
    const userCountDisplay = document.getElementById('user-count-display').querySelector('span');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const pencilTool = document.getElementById('pencil-tool');
    const rectangleTool = document.getElementById('rectangle-tool');

    // --- ESTADO DE LA APP ---
    let currentBoard = null;
    let snapshot = null;

    // --- CLASE PARA GESTIONAR LA PIZARRA ---
    class Board {
        constructor(boardId, name) {
            this.id = boardId;
            this.name = name;
            this.isDrawing = false;
            this.tool = 'pencil';
            this.startX = 0;
            this.startY = 0;
            this.currentColor = '#000';
            this.lineWidth = 5;
        }

        drawShape(data) {
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.width;
            ctx.lineCap = 'round';

            if (data.tool === 'pencil') {
                ctx.beginPath();
                ctx.moveTo(data.x0, data.y0);
                ctx.lineTo(data.x1, data.y1);
                ctx.stroke();
                ctx.closePath();
            } else if (data.tool === 'rectangle') {
                ctx.strokeRect(data.x, data.y, data.width, data.height);
            }
        }

        startDrawing(e) {
            this.isDrawing = true;
            this.startX = e.offsetX;
            this.startY = e.offsetY;
            snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        draw(e) {
            if (!this.isDrawing) return;

            if (snapshot) {
                ctx.putImageData(snapshot, 0, 0);
            }

            if (this.tool === 'pencil') {
                const data = {
                    tool: 'pencil',
                    x0: this.startX,
                    y0: this.startY,
                    x1: e.offsetX,
                    y1: e.offsetY,
                    color: this.currentColor,
                    width: this.lineWidth
                };
                this.drawShape(data);
                socket.emit('drawing', { boardId: this.id, ...data });
                this.startX = e.offsetX;
                this.startY = e.offsetY;
            } else if (this.tool === 'rectangle') {
                const data = {
                    tool: 'rectangle',
                    x: this.startX,
                    y: this.startY,
                    width: e.offsetX - this.startX,
                    height: e.offsetY - this.startY,
                    color: this.currentColor,
                    width: this.lineWidth,
                };
                this.drawShape(data);
            }
        }

        stopDrawing(e) {
            this.isDrawing = false;
            if (this.tool === 'rectangle') {
                const data = {
                    tool: 'rectangle',
                    x: this.startX,
                    y: this.startY,
                    width: e.offsetX - this.startX,
                    height: e.offsetY - this.startY,
                    color: this.currentColor,
                    width: this.lineWidth,
                };
                this.drawShape(data);
                socket.emit('drawing', { boardId: this.id, ...data });
            }
            snapshot = null;
        }

        clear() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        activate() {
            lobbyContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            boardNameDisplay.textContent = this.name;
            window.history.pushState({}, '', `/?board=${this.id}`);
            this.resizeCanvas();
        }

        resizeCanvas() {
            canvas.width = window.innerWidth * 0.9;
            canvas.height = window.innerHeight * 0.7;
        }
    }

    // --- LÓGICA DEL LOBBY ---
    function updatePublicBoards(boards) {
        publicBoardsList.innerHTML = '';
        for (const id in boards) {
            const li = document.createElement('li');
            li.textContent = `${boards[id].name} (${boards[id].userCount} users)`;
            li.dataset.boardId = id;
            li.addEventListener('click', () => {
                socket.emit('join-board', { boardId: id });
            });
            publicBoardsList.appendChild(li);
        }
    }

    createBoardBtn.addEventListener('click', () => {
        const boardName = newBoardNameInput.value.trim();
        const password = newBoardPasswordInput.value;
        if (boardName) {
            socket.emit('create-board', { boardName, password });
        } else {
            alert('Por favor, introduce un nombre para la pizarra.');
        }
    });

    joinBoardBtn.addEventListener('click', () => {
        const boardId = joinBoardIdInput.value.trim();
        const password = joinBoardPasswordInput.value;
        if (boardId) {
            socket.emit('join-board', { boardId, password });
        } else {
            alert('Por favor, introduce un ID de pizarra.');
        }
    });

    // --- MANEJO DE EVENTOS DE SOCKET ---
    socket.on('public-boards', (boards) => {
        updatePublicBoards(boards);
    });

    socket.on('board-created', (boardId) => {
        socket.emit('join-board', { boardId });
    });

    socket.on('joined-board', ({ boardId, name }) => {
        currentBoard = new Board(boardId, name);
        currentBoard.activate();
    });

    socket.on('join-error', (message) => {
        alert(`Error al unirse: ${message}`);
    });

    socket.on('drawing-history', (history) => {
        if (currentBoard) {
            history.forEach(data => currentBoard.drawShape(data));
        }
    });

    socket.on('drawing', (data) => {
        if (currentBoard) {
            currentBoard.drawShape(data);
        }
    });

    socket.on('board-cleared', () => {
        if (currentBoard) {
            currentBoard.clear();
        }
    });

    socket.on('update-user-count', (count) => {
        userCountDisplay.textContent = count;
    });

    // --- EVENTOS DEL CANVAS Y HERRAMIENTAS ---
    canvas.addEventListener('mousedown', (e) => currentBoard?.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => currentBoard?.draw(e));
    canvas.addEventListener('mouseup', (e) => currentBoard?.stopDrawing(e));
    canvas.addEventListener('mouseout', (e) => currentBoard?.stopDrawing(e));

    function setActiveTool(tool) {
        if (currentBoard) {
            currentBoard.tool = tool;
            pencilTool.classList.toggle('active', tool === 'pencil');
            rectangleTool.classList.toggle('active', tool === 'rectangle');
        }
    }

    pencilTool.addEventListener('click', () => setActiveTool('pencil'));
    rectangleTool.addEventListener('click', () => setActiveTool('rectangle'));

    colorPalette.forEach(colorDiv => {
        colorDiv.addEventListener('click', () => {
            if (currentBoard) {
                currentBoard.currentColor = colorDiv.dataset.color;
                colorPicker.value = currentBoard.currentColor;
            }
        });
    });

    colorPicker.addEventListener('input', (e) => {
        if (currentBoard) {
            currentBoard.currentColor = e.target.value;
        }
    });

    lineWidthInput.addEventListener('input', (e) => {
        if(currentBoard) {
            currentBoard.lineWidth = e.target.value;
        }
    });

    clearBtn.addEventListener('click', () => {
        if (currentBoard) {
            socket.emit('clear-board', currentBoard.id);
        }
    });

    downloadBtn.addEventListener('click', () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.fillStyle = '#ffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentBoard.name.toLowerCase().replace(/ /g, '_')}.png`;
        link.href = dataURL;
        link.click();
    });

    // --- INICIALIZACIÓN ---
    function initialize() {
        const urlParams = new URLSearchParams(window.location.search);
        const boardId = urlParams.get('board');
        if (boardId) {
            // Intenta unirse a la pizarra directamente si se proporciona en la URL
            // Aquí se podría pedir contraseña si fuera necesario
            socket.emit('join-board', { boardId });
        }
    }

    initialize();
});