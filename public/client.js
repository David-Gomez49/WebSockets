// public/client.js

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const canvas = document.getElementById('whiteboard');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const lineWidthInput = document.getElementById('lineWidth');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Ajustar tamaño del canvas
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.7;

    // Estado del lápiz
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Función reutilizable para dibujar una línea. Es clave para no repetir código.
    function drawLine(x0, y0, x1, y1, color, width) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round'; // Trazos redondeados
        ctx.stroke();
        ctx.closePath();
    }

    // --- MANEJO DE EVENTOS DE DIBUJO LOCAL ---
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
            color: colorPicker.value,
            width: lineWidthInput.value
        };

        // Dibuja en el canvas local INMEDIATAMENTE para una experiencia fluida.
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
        
        // Envía los datos del trazo al servidor.
        socket.emit('drawing', data);
        
        
        // Actualiza la última posición.
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }
    
    function stopDrawing() {
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing); // Si el mouse sale del canvas

    // --- MANEJO DE EVENTOS DE LOS CONTROLES ---
    clearBtn.addEventListener('click', () => {
        // No limpiamos localmente al instante, esperamos la confirmación del servidor
        // para mantener todo sincronizado. El servidor enviará 'board-cleared'.
        socket.emit('clear-board');
    });

    downloadBtn.addEventListener('click', () => {
    // 1. Crear un lienzo temporal en memoria (no es visible en la página)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // 2. Darle el mismo tamaño que nuestro lienzo visible
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // 3. Dibujar el color de fondo en el lienzo temporal
    tempCtx.fillStyle = '#ffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 4. Dibujar la imagen del lienzo visible ENCIMA del fondo que acabamos de crear
    tempCtx.drawImage(canvas, 0, 0);

    // 5. Generar la URL de la imagen desde el lienzo temporal
    const dataURL = tempCanvas.toDataURL('image/png');

    // 6. Crear y hacer clic en el enlace de descarga, como antes
    const link = document.createElement('a');
    link.download = 'pizarron-colaborativo.png';
    link.href = dataURL;
    link.click();
});

    // --- MANEJO DE EVENTOS DEL SERVIDOR ---

    // 1. Recibir y dibujar el historial al conectarse.
    socket.on('drawing-history', (history) => {
        console.log('Recibiendo historial de dibujo...');
        history.forEach(data => {
            drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
        });
    });

    // 2. Recibir y dibujar un trazo de otro usuario.
    socket.on('drawing', (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width);
    });

    // 3. Recibir la orden de limpiar el tablero.
    socket.on('board-cleared', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Para depuración
    socket.on('connect', () => {
        console.log(`Conectado al servidor con ID: ${socket.id}`);
    });
});