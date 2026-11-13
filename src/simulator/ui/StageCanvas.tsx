'use client';

/**
 * The stage: a canvas that shows the mat, the game elements and the robot.
 *
 * It redraws on the animation frames of the run loop (useSimulation) and reads the simulation
 * directly, so it never waits for React. It is sharp on high-resolution screens
 * (devicePixelRatio) and follows the size of its container.
 *
 * Before the start signal the robot can be placed with the pointer: drag = move, mouse wheel on
 * the robot = turn (hold Shift for 1 degree steps). With the keyboard: arrow keys move, Q / E turn.
 * On a touch screen a finger on the robot drags it; a finger anywhere else on the stage scrolls
 * the page as usual.
 *
 * While the ruler is on (props.ruler is not null) the pointer belongs to the ruler instead: a
 * click or a tap on the mat sets a point, a point can be dragged, and the robot stays where it
 * is - otherwise a click on the robot could not start a measurement there. The wheel and the
 * keyboard still move the robot. What the points mean, and the rules of the pointer (when a
 * press takes hold of a point and when it sets a new one), are in ./ruler.ts.
 */
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { Vec2 } from '../core/geometry';
import type { Pose, Simulation, ZoneOverlay } from '../core/types';
import { drawStage, fitView, MatPainter, robotHit, viewToMat, type StageOptions, type StageView } from './render';
import { addRulerPoint, dragRulerPoint, isRulerClick, rulerClick, rulerHold, type Ruler, type RulerHold, type RulerPointer } from './ruler';
import type { Trail } from './trail';

export interface StageCanvasProps {
  simRef: RefObject<Simulation<unknown>>;
  trail: Trail;
  subscribeFrame: (listener: (changed: boolean) => void) => () => void;
  options: StageOptions;
  overlays: ZoneOverlay[];
  /** the robot may be placed (before the start signal) */
  placing: boolean;
  /** a wanted start pose that is not allowed (drawn as a red outline), or null */
  ghost: Pose | null;
  /** the student moved the robot to `pose`; `phase` is 'end' when the pointer was released */
  onPlace: (pose: Pose, phase: 'move' | 'end') => void;
  /** the student turned the robot by this many degrees (clockwise positive) */
  onRotate: (degrees: number) => void;
  /** the measuring line while the ruler is on; null while it is off */
  ruler: Ruler | null;
  /** the student set or moved a point of the ruler */
  onRuler: (ruler: Ruler) => void;
}

/** How far outside the robot (mm) a click still grabs it - fingers are thicker than a mouse pointer. */
const GRAB_TOLERANCE = 14;
/** Wheel movement (pixels) that counts as one turning step: less than one notch of any mouse wheel. */
const WHEEL_STEP = 30;
/** Shortest time between two turning steps (ms), so that a trackpad swipe does not spin the robot. */
const WHEEL_PAUSE = 90;
/** A half-finished wheel movement is forgotten after this long (ms). */
const WHEEL_FORGET = 300;

/** What the ruler takes a pointer for: a mouse is exact, everything else (finger, pen) is a finger. */
function rulerPointer(pointerType: string): RulerPointer {
  return pointerType === 'mouse' ? 'mouse' : 'finger';
}

/**
 * A press on the stage while the ruler is on, from pointer down to pointer up:
 *   'tap'   a finger on free mat: it sets a point when it is lifted without having moved (it may be scrolling the page);
 *   'hold'  the pointer is on a point of the line: the point is dragged once the pointer moves,
 *           and a press that does not move is a click (see rulerClick in ./ruler.ts);
 *   'drag'  the point is being dragged.
 */
interface RulerPress {
  pointerId: number;
  pointer: RulerPointer;
  kind: 'tap' | 'hold' | 'drag';
  /** the point that is held or dragged (not used for a tap) */
  hold: RulerHold;
  /** where the pointer came down, in pixels of the window */
  x: number;
  y: number;
}

function StageCanvasImpl(props: StageCanvasProps) {
  const { simRef, trail, subscribeFrame } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<StageView | null>(null);
  /** true when the picture must be redrawn although the simulation did not change */
  const dirtyRef = useRef(true);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number; heading: number } | null>(null);
  const wheelRef = useRef({ travelled: 0, lastEvent: 0, lastStep: 0 });
  /**
   * The ruler as it is at this very moment. The pointer can move again before React has drawn
   * the screen with the point that was just set, so the handlers below read the ruler here and
   * not in the props.
   */
  const rulerRef = useRef<Ruler | null>(props.ruler);
  /** the press that is going on while the ruler is on (pointer down, not yet up) */
  const rulerPressRef = useRef<RulerPress | null>(null);

  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
    rulerRef.current = props.ruler;
    dirtyRef.current = true;
  });

  const [painter] = useState(() => new MatPainter(simRef.current.game.mat.vector));

  // ---- the mat picture (until it has loaded, the drawn version of the mat is shown)
  const imageUrl = simRef.current.game.mat.imageUrl;
  useEffect(() => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      painter.setImage(image);
      dirtyRef.current = true;
    };
    image.src = imageUrl;
    return () => {
      image.onload = null;
    };
  }, [imageUrl, painter]);

  // ---- follow the size of the container and the pixel density of the screen
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const mat = simRef.current.game.mat;
      viewRef.current = fitView(rect.width, rect.height, mat.width, mat.height, dpr);
      dirtyRef.current = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    // zooming the page or moving the window to another screen changes devicePixelRatio
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [simRef]);

  // ---- draw
  useEffect(
    () =>
      subscribeFrame((changed) => {
        if (!changed && !dirtyRef.current) return;
        const canvas = canvasRef.current;
        const view = viewRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !view || !ctx) return;
        dirtyRef.current = false;
        const p = propsRef.current;
        drawStage(ctx, {
          sim: simRef.current,
          view,
          options: p.options,
          mat: painter,
          trail,
          overlays: p.overlays,
          placing: p.placing,
          ghost: p.ghost,
          ruler: rulerRef.current,
        });
      }),
    [painter, simRef, subscribeFrame, trail],
  );

  // ---- placing the robot
  const matPoint = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return null;
    const rect = canvas.getBoundingClientRect();
    return viewToMat(view, clientX - rect.left, clientY - rect.top);
  }, []);

  /** The size of one screen pixel on the mat (mm), at the size the mat is shown now. */
  const mmPerPixel = useCallback((): number => {
    const view: StageView | null = viewRef.current;
    return view ? 1 / view.scale : 0;
  }, []);

  /** The pose under the pointer that can be grabbed: the red outline first, then the robot itself. */
  const grabbable = useCallback(
    (point: Vec2): Pose | null => {
      const p = propsRef.current;
      if (!p.placing) return null;
      const sim = simRef.current;
      if (p.ghost && robotHit(sim.robotConfig, p.ghost, point, GRAB_TOLERANCE)) return p.ghost;
      const pose = sim.world.robot.pose;
      return robotHit(sim.robotConfig, pose, point, GRAB_TOLERANCE) ? pose : null;
    },
    [simRef],
  );

  // Touch screens: a finger that lands on the robot is kept for dragging it (the page must not
  // scroll away under it); a finger anywhere else scrolls the page as usual. Saying "do not
  // scroll" is only possible in a listener that is registered as not passive, which React's
  // own onTouchStart is not.
  // While the ruler is on, the same goes for a finger that lands on a point of the ruler.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const point = touch ? matPoint(touch.clientX, touch.clientY) : null;
      if (!point || !event.cancelable) return;
      const ruler = rulerRef.current;
      const keep = ruler ? rulerHold(ruler, point, 'finger', mmPerPixel()) !== null : grabbable(point) !== null;
      if (keep) event.preventDefault();
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => canvas.removeEventListener('touchstart', onTouchStart);
  }, [grabbable, matPoint, mmPerPixel]);

  // ---- the ruler
  const changeRuler = (next: Ruler) => {
    if (next === rulerRef.current) return;
    rulerRef.current = next;
    dirtyRef.current = true;
    propsRef.current.onRuler(next);
  };

  /** The pose of the robot when `point` is on the robot, else null: a first ruler point set there snaps to its turning centre. */
  const robotUnder = (point: Vec2): Pose | null => {
    const sim = simRef.current;
    const pose = sim.world.robot.pose;
    return robotHit(sim.robotConfig, pose, point) ? { ...pose } : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const point = matPoint(event.clientX, event.clientY);
    if (!point) return;
    const canvas = event.currentTarget;

    const ruler = rulerRef.current;
    if (ruler) {
      // the keyboard focus comes to the stage, so that Escape (take the last point away) is heard here
      canvas.focus({ preventScroll: true });
      const pointer = rulerPointer(event.pointerType);
      const press = { pointerId: event.pointerId, pointer, x: event.clientX, y: event.clientY };
      const hold = rulerHold(ruler, point, pointer, mmPerPixel());
      if (hold) {
        // on a point: nothing changes yet. If the pointer moves, the point is dragged; if not, this was a click - see endRuler
        rulerPressRef.current = { ...press, kind: 'hold', hold };
      } else if (pointer === 'finger') {
        // a finger (or a pen) may be starting to scroll the page: only a tap sets a point - see endRuler
        rulerPressRef.current = { ...press, kind: 'tap', hold: { index: -1, dx: 0, dy: 0 } };
        return;
      } else {
        // a mouse sets the point at once and keeps hold of it, so that it can be put exactly before the button is let go
        const next = addRulerPoint(ruler, point, robotUnder(point), simRef.current.game.mat);
        if (next === ruler) return;
        changeRuler(next);
        rulerPressRef.current = { ...press, kind: 'drag', hold: { index: next.points.length - 1, dx: 0, dy: 0 } };
      }
      event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // the pointer is already gone: the drag simply ends at the edge of the stage
      }
      canvas.style.cursor = 'grabbing';
      return;
    }

    const pose = grabbable(point);
    if (!pose) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
    dragRef.current = { pointerId: event.pointerId, dx: point.x - pose.x, dy: point.y - pose.y, heading: pose.heading };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = matPoint(event.clientX, event.clientY);
    if (!point) return;
    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      propsRef.current.onPlace({ x: point.x - drag.dx, y: point.y - drag.dy, heading: drag.heading }, 'move');
      return;
    }
    const ruler = rulerRef.current;
    if (ruler) {
      const press = rulerPressRef.current;
      if (press && press.pointerId === event.pointerId) {
        if (event.pointerType === 'mouse' && event.buttons === 0) {
          // The button was let go where this page could not see it (over a menu, in another
          // window): the press is over. Without this the point would follow a mouse that only passes by.
          rulerPressRef.current = null;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // the canvas no longer holds the pointer: nothing to give back
          }
        } else {
          if (press.kind === 'hold' && !isRulerClick(Math.hypot(event.clientX - press.x, event.clientY - press.y), press.pointer)) press.kind = 'drag';
          if (press.kind === 'drag') changeRuler(dragRulerPoint(ruler, press.hold, point, robotUnder, simRef.current.game.mat));
          return;
        }
      }
      const onPoint = rulerHold(ruler, point, rulerPointer(event.pointerType), mmPerPixel()) !== null;
      event.currentTarget.style.cursor = onPoint ? 'grab' : 'crosshair';
      return;
    }
    event.currentTarget.style.cursor = grabbable(point) ? 'grab' : 'default';
  };

  /** The pointer was let go (`cancelled`: the browser took it away, for example to scroll the page). */
  const endRuler = (event: PointerEvent<HTMLCanvasElement>, cancelled: boolean): boolean => {
    const press = rulerPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return false;
    rulerPressRef.current = null;
    if (press.kind !== 'tap') event.currentTarget.style.cursor = 'grab';
    // a press that did not move is a click or a tap: it sets a point (a dragged point is already where it belongs)
    const ruler = rulerRef.current;
    const point = matPoint(event.clientX, event.clientY);
    const still = isRulerClick(Math.hypot(event.clientX - press.x, event.clientY - press.y), press.pointer);
    if (ruler && point && still && !cancelled && press.kind !== 'drag') {
      changeRuler(rulerClick(ruler, point, press.pointer, mmPerPixel(), robotUnder(point), simRef.current.game.mat));
    }
    return true;
  };

  /** The browser took the pointer away without a "pointer up" (it does that for some menus and gestures): the press is over. */
  const onLostPointerCapture = (event: PointerEvent<HTMLCanvasElement>) => {
    if (rulerPressRef.current?.pointerId === event.pointerId) rulerPressRef.current = null;
  };

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (endRuler(event, event.type === 'pointercancel')) return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.style.cursor = 'grab';
    const point = matPoint(event.clientX, event.clientY);
    if (point) propsRef.current.onPlace({ x: point.x - drag.dx, y: point.y - drag.dy, heading: drag.heading }, 'end');
  };

  // the wheel listener must be able to stop the page from scrolling, which React's onWheel cannot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const view = viewRef.current;
      if (!view) return;
      const rect = canvas.getBoundingClientRect();
      const point = viewToMat(view, event.clientX - rect.left, event.clientY - rect.top);
      const p = propsRef.current;
      if (!p.placing) return;
      const sim = simRef.current;
      const onRobot =
        robotHit(sim.robotConfig, sim.world.robot.pose, point, GRAB_TOLERANCE) ||
        (p.ghost !== null && robotHit(sim.robotConfig, p.ghost, point, GRAB_TOLERANCE));
      if (!onRobot) return;
      event.preventDefault();
      // with Shift held some browsers report the wheel as sideways scrolling
      const raw = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      const pixels = event.deltaMode === 1 ? raw * 33 : event.deltaMode === 2 ? raw * 300 : raw;
      const wheel = wheelRef.current;
      const now = performance.now();
      if (now - wheel.lastEvent > WHEEL_FORGET) wheel.travelled = 0;
      wheel.lastEvent = now;
      wheel.travelled += pixels;
      // one notch of a mouse wheel = one step; a long trackpad swipe = a few steps
      if (Math.abs(wheel.travelled) < WHEEL_STEP || now - wheel.lastStep < WHEEL_PAUSE) return;
      const direction = Math.sign(wheel.travelled);
      wheel.travelled = 0;
      wheel.lastStep = now;
      p.onRotate(direction * (event.shiftKey ? 1 : 15));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [simRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const p = propsRef.current;
    if (!p.placing) return;
    const step = event.shiftKey ? 1 : 5;
    const base = p.ghost ?? simRef.current.world.robot.pose;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      p.onPlace({ x: base.x + move[0], y: base.y + move[1], heading: base.heading }, 'end');
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'q' || key === 'e') {
      event.preventDefault();
      p.onRotate((key === 'q' ? -1 : 1) * (event.shiftKey ? 1 : 15));
    }
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-card bg-ink-600 shadow-inner">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={
          props.ruler
            ? 'Competition mat seen from above. The ruler is on: a click on the mat sets a point. The measurement is written next to the mat.'
            : props.placing
              ? 'Competition mat seen from above. The robot can be placed: drag it, or use the arrow keys to move and Q or E to turn.'
              : 'Competition mat seen from above, with the robot and the game elements.'
        }
        // (the frame around the stage clips whatever is drawn outside the canvas, so the focus ring is drawn inside its edge)
        className="absolute inset-0 h-full w-full rounded-card focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-brand-400"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={onLostPointerCapture}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export const StageCanvas = memo(StageCanvasImpl);
