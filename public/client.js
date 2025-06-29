document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Selección de elementos 
    const canvas = document.getElementById('whiteboard');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const colorPalette = document.querySelectorAll('.palette-color');
    const lineWidthInput = document.getElementById('lineWidth');
    const userCountDisplay = document.getElementById('user-count-display').querySelector('span');

    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Ajustar tamaño inicial del canvas
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.7;

    // Estado del lápiz
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = '#000'; 

    // Función reutilizable para dibujar una línea
    function drawLine(x0, y0, x1, y1, color, width) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.closePath();
    }

    // Función para gestionar visualmente el color activo
    function setActiveColor(element) {
        colorPalette.forEach(c => c.classList.remove('active'));
        colorPicker.classList.remove('active');
        if (element) {
            element.classList.add('active');
        }
    }

    // --- MANEJO DE EVENTOS ---
    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function draw(e) {
        if (!isDrawing) return;
        const data = {
            x0: lastX,
            y0: lastY,
            x1: e.offsetX,
            y1: e.offsetY,
            color: currentColor,
            width: lineWidthInput.value
        };
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
        socket.emit('drawing', data);
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }
    
    function stopDrawing() {
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    
    colorPalette.forEach(colorDiv => {
        colorDiv.addEventListener('click', () => {
            currentColor = colorDiv.dataset.color;
            colorPicker.value = currentColor;
            setActiveColor(colorDiv);
        });
    });

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        setActiveColor(colorPicker);
    });

    clearBtn.addEventListener('click', () => {
        socket.emit('clear-board');
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
        link.download = 'pizarron-colaborativo.png';
        link.href = dataURL;
        link.click();
    });

    // --- MANEJO DE EVENTOS DEL SERVIDOR ---
    socket.on('drawing-history', (history) => {
        history.forEach(data => {
            drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
        });
    });

    socket.on('drawing', (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
    });

    socket.on('board-cleared', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on('update-user-count', (count) => {
        userCountDisplay.textContent = count;
    });
    
    socket.on('connect', () => {
        console.log(`Conectado al servidor con ID: ${socket.id}`);
    });

    // --- INICIALIZACIÓN ---
    const initialActiveColor = document.querySelector('.palette-color.active');
    if (initialActiveColor) {
        currentColor = initialActiveColor.dataset.color;
        colorPicker.value = currentColor;
        setActiveColor(initialActiveColor);
    }
});