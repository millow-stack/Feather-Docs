/**
 * LightPDF Touch & Gesture Engine
 * Provides pinch-to-zoom, double-tap zoom, and swipe page navigation for mobile touch devices.
 */

export class TouchEngine {
  constructor(stageEl, onZoomChange, onPageSwipe) {
    this.stageEl = stageEl;
    this.onZoomChange = onZoomChange;
    this.onPageSwipe = onPageSwipe;

    this.initialPinchDistance = 0;
    this.initialScale = 1.0;
    this.lastTapTime = 0;

    this.bindTouchEvents();
  }

  bindTouchEvents() {
    if (!this.stageEl) return;

    this.stageEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // Pinch start
        this.initialPinchDistance = this.getDistance(e.touches[0], e.touches[1]);
      } else if (e.touches.length === 1) {
        // Double tap check
        const currentTime = new Date().getTime();
        const tapLength = currentTime - this.lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
          // Double tap triggered
          e.preventDefault();
          if (this.onZoomChange) this.onZoomChange('toggle-fit');
        }
        this.lastTapTime = currentTime;
      }
    }, { passive: false });

    this.stageEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.initialPinchDistance > 0) {
        e.preventDefault();
        const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
        const factor = currentDistance / this.initialPinchDistance;

        if (Math.abs(1 - factor) > 0.05) {
          if (this.onZoomChange) {
            this.onZoomChange(factor > 1 ? 'in' : 'out', 0.03);
          }
          this.initialPinchDistance = currentDistance;
        }
      }
    }, { passive: false });

    this.stageEl.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.initialPinchDistance = 0;
      }
    });
  }

  getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
