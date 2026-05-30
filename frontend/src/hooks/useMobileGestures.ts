import { useEffect, useRef, useCallback } from 'react';

interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  onPinchIn?: () => void;
  onPinchOut?: () => void;
}

const SWIPE_THRESHOLD = 50;
const LONG_PRESS_DURATION = 500;
const DOUBLE_TAP_DELAY = 300;

export const useMobileGestures = (
  elementRef: React.RefObject<HTMLElement>,
  handlers: GestureHandlers
) => {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const initialDistance = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchStartTime.current = Date.now();

      if (e.touches.length === 2) {
        const touch2 = e.touches[1];
        initialDistance.current = Math.hypot(
          touch2.clientX - touch.clientX,
          touch2.clientY - touch.clientY
        );
      }

      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        handlers.onLongPress?.();
      }, LONG_PRESS_DURATION);
    },
    [handlers]
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (initialDistance.current > 0) {
        if (currentDistance > initialDistance.current * 1.1) {
          handlers.onPinchOut?.();
        } else if (currentDistance < initialDistance.current * 0.9) {
          handlers.onPinchIn?.();
        }
      }
    }

    // Clear long press timer on movement
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, [handlers]);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const touchEndX = touch.clientX;
      const touchEndY = touch.clientY;
      const touchDuration = Date.now() - touchStartTime.current;

      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }

      // Calculate distances
      const distanceX = touchEndX - touchStartX.current;
      const distanceY = touchEndY - touchStartY.current;
      const absDistanceX = Math.abs(distanceX);
      const absDistanceY = Math.abs(distanceY);

      // Check for swipe
      if (touchDuration < 300) {
        if (absDistanceX > SWIPE_THRESHOLD && absDistanceX > absDistanceY) {
          if (distanceX > 0) {
            handlers.onSwipeRight?.();
          } else {
            handlers.onSwipeLeft?.();
          }
        } else if (absDistanceY > SWIPE_THRESHOLD && absDistanceY > absDistanceX) {
          if (distanceY > 0) {
            handlers.onSwipeDown?.();
          } else {
            handlers.onSwipeUp?.();
          }
        }

        // Check for double tap
        const now = Date.now();
        if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
          handlers.onDoubleTap?.();
          lastTapTime.current = 0;
        } else {
          lastTapTime.current = now;
        }
      }
    },
    [handlers]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, false);
    element.addEventListener('touchmove', handleTouchMove, false);
    element.addEventListener('touchend', handleTouchEnd, false);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart, false);
      element.removeEventListener('touchmove', handleTouchMove, false);
      element.removeEventListener('touchend', handleTouchEnd, false);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    swipeLeft: handlers.onSwipeLeft,
    swipeRight: handlers.onSwipeRight,
    swipeUp: handlers.onSwipeUp,
    swipeDown: handlers.onSwipeDown,
    longPress: handlers.onLongPress,
    doubleTap: handlers.onDoubleTap
  };
};

export default useMobileGestures;
