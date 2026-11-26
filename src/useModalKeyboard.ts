import {useLayoutEffect, type RefObject} from 'react';

const editorSelector = 'textarea, input:not([type]), input:is([type=text],[type=number],[type=email],[type=url],[type=tel],[type=password],[type=search]), [contenteditable=true]';

function scrollBody(target: Element, dialog: HTMLDialogElement) {
  let body: HTMLElement | null = null;
  for (let node = target.parentElement; node && node !== dialog; node = node.parentElement) {
    // Horizontal clipping on swipeable rows also computes to overflow-y:auto.
    // The outer scrollport owns the editor's header/body/footer layout.
    if (/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) body = node;
  }
  return body;
}

export function useModalKeyboard(dialogRef: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const viewport = window.visualViewport;
    let layoutHeight = document.documentElement.clientHeight;
    let layoutWidth = document.documentElement.clientWidth;
    let field: HTMLElement | null = null;
    let body: HTMLElement | null = null;
    let origin = 0;
    let manual = false;
    let avoiding = false;
    let frame = 0;
    let until = 0;
    let tappedAt = -Infinity;
    let beforeTap: {body: HTMLElement; top: number} | undefined;

    // Extra scroll range for the last field, without adding flow content or changing
    // the scrollport's own height. Its containing block is the modal body.
    const runway = document.createElement('span');
    runway.className = 'modal-keyboard-runway';
    runway.setAttribute('aria-hidden', 'true');
    function finish() {
      runway.remove();
      body?.removeAttribute('data-keyboard-scrollport');
      if (body && avoiding && !manual) body.scrollTop = origin;
      avoiding = false;
    }
    function layout() {
      const root = document.documentElement;
      // iOS normally resizes only the visual viewport. Also tolerate a standalone
      // host reporting a keyboard-induced layout resize before the final blur.
      const editing = field || avoiding || dialog!.contains(document.activeElement) && document.activeElement?.matches(editorSelector) || performance.now() - tappedAt < 600;
      const touchDevice = navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
      if (root.clientWidth !== layoutWidth || !(editing && touchDevice && root.clientHeight < layoutHeight)) {
        layoutHeight = root.clientHeight;
        layoutWidth = root.clientWidth;
      }
      dialog!.style.setProperty('--food-viewport-height', layoutHeight + 'px');
    }
    function settle() {
      frame = 0;
      const active = document.activeElement;
      if (!field || active !== field || !body) {
        finish();
        field = null;
        body = null;
        return;
      }
      const visibleHeight = viewport?.height ?? innerHeight;
      if ((viewport?.scale ?? 1) !== 1 || visibleHeight >= layoutHeight - 1) {
        finish();
        return;
      }
      avoiding = true;
      if (manual) return;
      const bounds = body.getBoundingClientRect();
      const box = field.getBoundingClientRect();
      const viewportTop = viewport?.offsetTop ?? 0;
      const top = Math.max(bounds.top, viewportTop);
      const bottom = Math.min(bounds.bottom, viewportTop + visibleHeight);
      if (bottom <= top) return;
      // Use the pre-focus scroll position as the reference. Native focus panning
      // and incremental keyboard animation must not compound the displacement.
      const offset = body.scrollTop - origin;
      const originalTop = box.top + offset, originalBottom = box.bottom + offset;
      const margin = 16;
      let target = origin;
      if (originalTop < top || (originalBottom > bottom && box.height > bottom - top - margin * 2)) target += originalTop - top - margin;
      else if (originalBottom > bottom) target += originalBottom - bottom + margin;
      target = Math.max(0, target);
      if (target > body.scrollHeight - body.clientHeight + 0.5) {
        body.setAttribute('data-keyboard-scrollport','');
        runway.style.top = Math.ceil(target + body.clientHeight) + 'px';
        if (runway.parentElement !== body) body.append(runway);
      }
      if (Math.abs(body.scrollTop - target) > 1) body.scrollTop = target;
      if (performance.now() < until) frame = requestAnimationFrame(settle);
    }
    function schedule() {
      until = performance.now() + 350;
      if (!frame) frame = requestAnimationFrame(settle);
    }
    function pointer(event: Event) {
      tappedAt = performance.now();
      const el = event.target;
      const scroller = el instanceof Element && el.closest('dialog') === dialog && scrollBody(el,dialog!);
      beforeTap = scroller ? {body:scroller,top:scroller.scrollTop} : undefined;
    }
    function focus() {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('dialog') === dialog && active.matches(editorSelector)) {
        const next = scrollBody(active,dialog!);
        if (next !== body) finish();
        if (next !== body || !avoiding || manual) origin = beforeTap && beforeTap.body === next ? beforeTap.top : next?.scrollTop ?? 0;
        body = next;
        field = active;
        manual = false;
      }
      beforeTap = undefined;
      schedule();
    }
    function gesture(event: Event) {
      if (body && event.target instanceof Node && body.contains(event.target)) manual = true;
    }
    function resize() { layout(); schedule(); }
    layout();
    dialog.addEventListener('pointerdown', pointer, true);
    dialog.addEventListener('focusin', focus);
    dialog.addEventListener('focusout', schedule);
    dialog.addEventListener('touchmove', gesture, {passive:true});
    dialog.addEventListener('wheel', gesture, {passive:true});
    window.addEventListener('resize',resize);
    viewport?.addEventListener('resize',schedule);
    viewport?.addEventListener('scroll',schedule);
    dialog.showModal();
    focus();
    return () => {
      cancelAnimationFrame(frame);
      finish();
      dialog.removeEventListener('pointerdown',pointer,true);
      dialog.removeEventListener('focusin',focus);
      dialog.removeEventListener('focusout',schedule);
      dialog.removeEventListener('touchmove',gesture);
      dialog.removeEventListener('wheel',gesture);
      window.removeEventListener('resize',resize);
      viewport?.removeEventListener('resize',schedule);
      viewport?.removeEventListener('scroll',schedule);
    };
  }, [dialogRef]);
}
