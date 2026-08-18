/**
 * LightPDF Annotation Engine
 * Enables freehand drawing (ink), text highlights, sticky notes, and annotations.
 */

export class AnnotationEngine {
  constructor() {
    this.activeTool = 'select'; // 'select', 'pen', 'highlight', 'note', 'eraser'
    this.color = '#ffffff';
    this.strokeWidth = 3;
    this.annotations = new Map(); // pageNo -> Array of shape objects
    this.isDrawing = false;
    this.currentPath = null;
    this.activeCanvas = null;
  }

  setTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll('.annotation-canvas').forEach(canvas => {
      if (tool === 'pen' || tool === 'eraser' || tool === 'highlight') {
        canvas.classList.add('active');
      } else {
        canvas.classList.remove('active');
      }
    });
  }

  setColor(color) {
    this.color = color;
  }

  setStrokeWidth(width) {
    this.strokeWidth = width;
  }

  initPageAnnotationLayer(pageNo, pageWrapper) {
    let canvas = pageWrapper.querySelector('.annotation-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'annotation-canvas';
      if (this.activeTool === 'pen' || this.activeTool === 'eraser' || this.activeTool === 'highlight') {
        canvas.classList.add('active');
      }
      pageWrapper.appendChild(canvas);
    }

    const rect = pageWrapper.getBoundingClientRect();
    canvas.width = Math.floor(rect.width) || pageWrapper.clientWidth;
    canvas.height = Math.floor(rect.height) || pageWrapper.clientHeight;

    this.bindCanvasEvents(canvas, pageNo);
    this.redrawPage(pageNo, canvas);
  }

  bindCanvasEvents(canvas, pageNo) {
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      if (this.activeTool === 'select' || this.activeTool === 'note') return;
      this.isDrawing = true;
      this.activeCanvas = canvas;
      const pos = getPos(e);
      this.currentPath = {
        tool: this.activeTool,
        color: this.activeTool === 'highlight' ? this.color + '66' : this.color,
        width: this.activeTool === 'highlight' ? 14 : this.strokeWidth,
        points: [pos]
      };
    };

    const draw = (e) => {
      if (!this.isDrawing || !this.currentPath) return;
      e.preventDefault();
      const pos = getPos(e);
      this.currentPath.points.push(pos);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.redrawPage(pageNo, canvas);
      this.drawPath(ctx, this.currentPath);
    };

    const endDraw = () => {
      if (!this.isDrawing || !this.currentPath) return;
      this.isDrawing = false;

      if (!this.annotations.has(pageNo)) {
        this.annotations.set(pageNo, []);
      }
      this.annotations.get(pageNo).push(this.currentPath);
      this.currentPath = null;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
  }

  drawPath(ctx, shape) {
    if (!shape.points || shape.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
  }

  redrawPage(pageNo, canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageAnnos = this.annotations.get(pageNo) || [];
    for (const shape of pageAnnos) {
      this.drawPath(ctx, shape);
    }
  }

  clearPage(pageNo) {
    this.annotations.set(pageNo, []);
    const canvas = document.querySelector(`[data-page="${pageNo}"] .annotation-canvas`);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  exportAnnotations() {
    const exportObj = {};
    for (const [pageNo, shapes] of this.annotations.entries()) {
      if (shapes.length > 0) exportObj[pageNo] = shapes;
    }
    return exportObj;
  }

  importAnnotations(data) {
    if (!data) return;
    this.annotations.clear();
    for (const pageNoStr in data) {
      this.annotations.set(parseInt(pageNoStr, 10), data[pageNoStr]);
    }
  }
}
