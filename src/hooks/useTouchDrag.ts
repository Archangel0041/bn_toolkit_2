/**
 * Touch-friendly drag and selection hook for mobile devices
 * Implements "tap to select, tap to place" pattern for mobile
 */

import { useState, useCallback, useRef } from "react";

export interface TouchDragState {
  // Currently selected item for moving (tap-to-select mode)
  selectedForMove: {
    gridId: number;
    unitId: number;
  } | null;
  // Whether we're in move mode
  isInMoveMode: boolean;
}

export interface UseTouchDragOptions {
  onMove?: (fromGridId: number, toGridId: number) => void;
  onAdd?: (unitId: number, gridId: number) => void;
  disabled?: boolean;
}

export function useTouchDrag(options: UseTouchDragOptions = {}) {
  const { onMove, onAdd, disabled } = options;
  
  const [state, setState] = useState<TouchDragState>({
    selectedForMove: null,
    isInMoveMode: false,
  });

  // Track if current interaction is a long press
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Select a unit for moving (first tap)
  const selectForMove = useCallback((gridId: number, unitId: number) => {
    if (disabled) return;
    setState({
      selectedForMove: { gridId, unitId },
      isInMoveMode: true,
    });
  }, [disabled]);

  // Complete the move (second tap on destination)
  const completeMove = useCallback((targetGridId: number) => {
    if (disabled || !state.selectedForMove) return false;
    
    const { gridId: fromGridId } = state.selectedForMove;
    
    if (fromGridId !== targetGridId && onMove) {
      onMove(fromGridId, targetGridId);
    }
    
    // Clear selection
    setState({
      selectedForMove: null,
      isInMoveMode: false,
    });
    
    return true;
  }, [disabled, state.selectedForMove, onMove]);

  // Cancel move mode
  const cancelMove = useCallback(() => {
    setState({
      selectedForMove: null,
      isInMoveMode: false,
    });
  }, []);

  // Handle tap on a slot - either select or place
  const handleSlotTap = useCallback((gridId: number, unitId: number | null, isEmpty: boolean) => {
    if (disabled) return;

    // If we're in move mode and tapping on a different slot
    if (state.isInMoveMode && state.selectedForMove) {
      // Tapping on the same slot cancels
      if (state.selectedForMove.gridId === gridId) {
        cancelMove();
        return { action: 'cancelled' as const };
      }
      
      // Move to new position
      completeMove(gridId);
      return { action: 'moved' as const };
    }
    
    // Not in move mode - if tapping on a unit, select it for moving
    if (!isEmpty && unitId !== null) {
      selectForMove(gridId, unitId);
      return { action: 'selected' as const };
    }
    
    return { action: 'none' as const };
  }, [disabled, state.isInMoveMode, state.selectedForMove, cancelMove, completeMove, selectForMove]);

  // Touch event handlers to prevent default image drag behavior
  const getTouchHandlers = useCallback((gridId: number, unitId: number | null, isEmpty: boolean) => {
    return {
      onTouchStart: (e: React.TouchEvent) => {
        // Store touch start position
        touchStartPos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        
        // Prevent default to stop image drag on mobile
        // Only prevent if there's a unit (image) in this slot
        if (!isEmpty) {
          e.preventDefault();
        }
      },
      onTouchMove: (e: React.TouchEvent) => {
        // If moved significantly, cancel any selection intent
        if (touchStartPos.current) {
          const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
          const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
          if (dx > 10 || dy > 10) {
            touchStartPos.current = null;
          }
        }
      },
      onTouchEnd: (e: React.TouchEvent) => {
        // Only trigger tap if we didn't move
        if (touchStartPos.current) {
          handleSlotTap(gridId, unitId, isEmpty);
          touchStartPos.current = null;
        }
      },
      // Prevent context menu on long press
      onContextMenu: (e: React.MouseEvent) => {
        if (!isEmpty) {
          e.preventDefault();
        }
      },
    };
  }, [handleSlotTap]);

  // Check if a slot is the selected source for moving
  const isSelectedForMove = useCallback((gridId: number) => {
    return state.isInMoveMode && state.selectedForMove?.gridId === gridId;
  }, [state.isInMoveMode, state.selectedForMove]);

  // Check if a slot is a valid drop target (when in move mode)
  const isValidMoveTarget = useCallback((gridId: number) => {
    return state.isInMoveMode && state.selectedForMove?.gridId !== gridId;
  }, [state.isInMoveMode, state.selectedForMove]);

  return {
    state,
    isInMoveMode: state.isInMoveMode,
    selectedForMove: state.selectedForMove,
    selectForMove,
    completeMove,
    cancelMove,
    handleSlotTap,
    getTouchHandlers,
    isSelectedForMove,
    isValidMoveTarget,
  };
}
