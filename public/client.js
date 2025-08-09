document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- ELEMENTOS DEL DOM ---
    const lobbyContainer = document.getElementById('lobby-container');
    const appContainer = document.querySelector('.app-container');
    const boardNameDisplay = document.getElementById('board-name-display');
    const publicBoardsList = document.getElementById('public-boards-list');
    const createBoardBtn = document.getElementById('create-board-btn');
    const newBoardNameInput = document.getElementById('new-board-name');
    const newBoardPasswordInput = document.getElementById('new-board-password');
    const joinBoardBtn = document.getElementById('join-board-btn');
    const joinBoardIdInput = document.getElementById('join-board-id');
    const joinBoardPasswordInput = document.getElementById('join-board-password');
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
    const lineTool = document.getElementById('line-tool'); // <-- Nuevo
    const circleTool = document.getElementById('circle-tool'); // <-- Nuevo
    const toolButtons = [pencilTool, lineTool, rectangleTool, circleTool]; // Array 
    const copyBoardIdBtn = document.getElementById('copy-board-id-btn');
    const copyFeedback = document.getElementById('copy-feedback');
    const leaveBoardBtn = document.getElementById('leave-board-btn');


    let currentBoard = null;

    class Board {
        constructor(boardId, name) {
            this.id = boardId;
            this.name = name;
            this.history = [];
            this.isDrawing = false;
            this.tool = 'pencil';
            this.startX = 0;
            this.startY = 0;
            this.currentColor = '#000000';
            this.lineWidth = 5;
            this.snapshot = null;
        }

        drawShape(data, isLocal = false) {
            if (!ctx) return;
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath(); // Iniciar un nuevo trazo para evitar conectar formas

            switch (data.tool) {
                case 'pencil':
                    ctx.moveTo(data.x0, data.y0);
                    ctx.lineTo(data.x1, data.y1);
                    break;
                case 'rectangle':
                    ctx.rect(data.x, data.y, data.w, data.h);
                    break;
                case 'circle':
                    ctx.arc(data.cx, data.cy, data.radius, 0, 2 * Math.PI);
                    break;
                case 'line':
                    ctx.moveTo(data.x0, data.y0);
                    ctx.lineTo(data.x1, data.y1);
                    break;
            }
            ctx.stroke();

            if (isLocal) {
                this.history.push(data);
            }
        }

        loadHistory(history) {
            this.history = history;
            this.redraw();
        }

        redraw() {
            this.clearCanvas();
            this.history.forEach(data => this.drawShape(data));
        }

        startDrawing(e) {
            this.isDrawing = true;
            this.startX = e.offsetX;
            this.startY = e.offsetY;
            // Guardar el estado actual del canvas para previsualizaciones no destructivas
            this.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        draw(e) {
            if (!this.isDrawing) return;
            
            // Para formas con previsualización, restauramos el canvas antes de dibujar la nueva previsualización
            if (this.tool !== 'pencil' && this.snapshot) {
                ctx.putImageData(this.snapshot, 0, 0);
            }

            const currentX = e.offsetX;
            const currentY = e.offsetY;

            let data; // Objeto de datos para la forma actual

            switch (this.tool) {
                case 'pencil':
                    data = { tool: 'pencil', x0: this.startX, y0: this.startY, x1: currentX, y1: currentY, color: this.currentColor, width: this.lineWidth };
                    this.drawShape(data, true); // Dibuja y guarda en el historial local
                    socket.emit('drawing', { boardId: this.id, ...data });
                    // Actualizar el punto de inicio para el siguiente segmento
                    this.startX = currentX;
                    this.startY = currentY;
                    break;

                case 'rectangle':
                    data = { tool: 'rectangle', x: Math.min(currentX, this.startX), y: Math.min(currentY, this.startY), w: Math.abs(currentX - this.startX), h: Math.abs(currentY - this.startY), color: this.currentColor, width: this.lineWidth };
                    this.drawShape(data); // Solo previsualiza
                    break;
                
                case 'circle':
                    const radius = Math.sqrt(Math.pow(currentX - this.startX, 2) + Math.pow(currentY - this.startY, 2));
                    data = { tool: 'circle', cx: this.startX, cy: this.startY, radius, color: this.currentColor, width: this.lineWidth };
                    this.drawShape(data); // Solo previsualiza
                    break;
                
                case 'line':
                    data = { tool: 'line', x0: this.startX, y0: this.startY, x1: currentX, y1: currentY, color: this.currentColor, width: this.lineWidth };
                    this.drawShape(data); // Solo previsualiza
                    break;
            }
        }

        stopDrawing(e) {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            
            // Para las formas que no son el lápiz, dibujamos la forma final y la emitimos
            if (this.tool !== 'pencil') {
                if (this.snapshot) ctx.putImageData(this.snapshot, 0, 0);
                
                const currentX = e.offsetX;
                const currentY = e.offsetY;
                let data;

                switch (this.tool) {
                    case 'rectangle':
                        data = { tool: 'rectangle', x: Math.min(currentX, this.startX), y: Math.min(currentY, this.startY), w: Math.abs(currentX - this.startX), h: Math.abs(currentY - this.startY), color: this.currentColor, width: this.lineWidth };
                        break;
                    case 'circle':
                         const radius = Math.sqrt(Math.pow(currentX - this.startX, 2) + Math.pow(currentY - this.startY, 2));
                         data = { tool: 'circle', cx: this.startX, cy: this.startY, radius, color: this.currentColor, width: this.lineWidth };
                        break;
                    case 'line':
                        data = { tool: 'line', x0: this.startX, y0: this.startY, x1: currentX, y1: currentY, color: this.currentColor, width: this.lineWidth };
                        break;
                }
                
                if (data) {
                    this.drawShape(data, true); // Dibuja la forma final y la guarda en el historial
                    socket.emit('drawing', { boardId: this.id, ...data });
                }
            }

            this.snapshot = null;
        }

        clearCanvas() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        clearBoard() {
            this.history = [];
            this.clearCanvas();
        }
        activate() {
            lobbyContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            boardNameDisplay.textContent = this.name;
            window.history.pushState({}, '', `/?board=${this.id}`);
            this.resizeCanvas();
            this.redraw();
            window.addEventListener('resize', () => this.resizeCanvasAndRedraw());
        }
        resizeCanvasAndRedraw() {
            this.resizeCanvas();
            this.redraw();
        }
        resizeCanvas() {
            const topOffset = canvas.getBoundingClientRect().top;
            canvas.width = window.innerWidth * 0.98;
            canvas.height = window.innerHeight - topOffset - 20;
        }
    }

    function updatePublicBoards(boards) {
        publicBoardsList.innerHTML = '';
        if (Object.keys(boards).length === 0) {
            publicBoardsList.innerHTML = '<li class="no-boards">No hay pizarras públicas. ¡Crea una!</li>';
            return;
        }
        for (const id in boards) {
            const li = document.createElement('li');
            const userText = boards[id].userCount === 1 ? 'usuario' : 'usuarios';
            li.textContent = `${boards[id].name} (${boards[id].userCount} ${userText})`;
            li.dataset.boardId = id;
            li.addEventListener('click', () => {
                socket.emit('join-board', { boardId: id });
            });
            publicBoardsList.appendChild(li);
        }
    }

    createBoardBtn.addEventListener('click', () => {
        const boardName = newBoardNameInput.value.trim();
        if (boardName) {
            socket.emit('create-board', {
                boardName,
                password: newBoardPasswordInput.value
            });
            newBoardNameInput.value = '';
            newBoardPasswordInput.value = '';
        } else {
            alert('Por favor, introduce un nombre para la pizarra.');
        }
    });

    joinBoardBtn.addEventListener('click', () => {
        const boardId = joinBoardIdInput.value.trim();
        if (boardId) {
            socket.emit('join-board', {
                boardId,
                password: joinBoardPasswordInput.value
            });
            joinBoardPasswordInput.value = '';
        } else {
            alert('Por favor, introduce un ID de pizarra.');
        }
    });

    copyBoardIdBtn.addEventListener('click', () => {
        if (!currentBoard) return;
        navigator.clipboard.writeText(currentBoard.id).then(() => {
            copyFeedback.textContent = '¡Copiado!';
            copyBoardIdBtn.classList.add('copied');
            setTimeout(() => {
                copyFeedback.textContent = 'Copiar ID';
                copyBoardIdBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Error al copiar ID: ', err);
            alert('No se pudo copiar el ID.');
        });
    });

     leaveBoardBtn.addEventListener('click', () => {
        if (!currentBoard) return;

        // Notificar al servidor que el usuario está saliendo
        socket.emit('leave-board');
        
        // Ocultar la pizarra y mostrar el lobby
        appContainer.style.display = 'none';
        lobbyContainer.style.display = 'block';

        // Limpiar el estado del cliente
        currentBoard = null;

        // Limpiar la URL para no tener el ID de la pizarra
        window.history.pushState({}, '', window.location.pathname);
    });


    socket.on('public-boards', updatePublicBoards);

    socket.on('joined-board', ({ boardId, name, history }) => {
        currentBoard = new Board(boardId, name);
        currentBoard.activate();
        currentBoard.loadHistory(history);
    });

    socket.on('public-boards', updatePublicBoards);

    socket.on('joined-board', ({ boardId, name, history }) => {
        currentBoard = new Board(boardId, name);
        currentBoard.activate();
        currentBoard.loadHistory(history);
    });

    socket.on('join-error', (message) => {
        alert(`Error al unirse: ${message}`);
    });

    socket.on('drawing', (data) => {
        if (currentBoard) {
            currentBoard.history.push(data,false);
            currentBoard.drawShape(data);
        }
    });

    socket.on('board-cleared', () => {
        if (currentBoard) {
            currentBoard.clearBoard();
        }
    });

    socket.on('update-user-count', (count) => {
        userCountDisplay.textContent = count;
    });

    canvas.addEventListener('mousedown', (e) => currentBoard?.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => currentBoard?.draw(e));
    canvas.addEventListener('mouseup', (e) => currentBoard?.stopDrawing(e));
    canvas.addEventListener('mouseout', (e) => {
        if (currentBoard?.isDrawing) {
            currentBoard.stopDrawing(e);
        }
    });

    function setActiveTool(tool) {
        if (!currentBoard) return;
        currentBoard.tool = tool;
        // Quitar la clase 'active' de todos los botones
        toolButtons.forEach(button => button.classList.remove('active'));
        // Añadir la clase 'active' solo al botón seleccionado
        document.getElementById(`${tool}-tool`).classList.add('active');
    }

    // Listeners para los botones de herramientas
    pencilTool.addEventListener('click', () => setActiveTool('pencil'));
    lineTool.addEventListener('click', () => setActiveTool('line'));
    rectangleTool.addEventListener('click', () => setActiveTool('rectangle'));
    circleTool.addEventListener('click', () => setActiveTool('circle'));
    
    function selectColor(color, fromPicker = false) {
        if (!currentBoard) return;
        currentBoard.currentColor = color;
        if (!fromPicker) {
            colorPicker.value = color;
        }
        colorPalette.forEach(div => {
            div.classList.toggle('active', div.dataset.color.toUpperCase() === color.toUpperCase());
        });
    }
    colorPalette.forEach(colorDiv => {
        colorDiv.addEventListener('click', () => selectColor(colorDiv.dataset.color));
    });
    colorPicker.addEventListener('input', (e) => selectColor(e.target.value, true));

    lineWidthInput.addEventListener('input', (e) => {
        if (currentBoard) {
            currentBoard.lineWidth = e.target.value;
        }
    });

    clearBtn.addEventListener('click', () => {
        if (currentBoard && confirm('¿Estás seguro de que quieres limpiar toda la pizarra? Esta acción no se puede deshacer.')) {
            socket.emit('clear-board', currentBoard.id);
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (!currentBoard) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentBoard.name.toLowerCase().replace(/\s+/g, '_')}_pizarron.png`;
        link.href = dataURL;
        link.click();
    });

    function initialize() {
        selectColor('#000000');
        setActiveTool('pencil');
        const urlParams = new URLSearchParams(window.location.search);
        const boardId = urlParams.get('board');
        if (boardId) {
            if (boardId) {
            socket.emit('join-board', { boardId, password: '' });
        }
        }
    }
    initialize();
});