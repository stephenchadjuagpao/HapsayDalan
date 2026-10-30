import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ResponsiveSelect.css";

export default function ResponsiveSelect({ children, options: suppliedOptions, value, onChange, id: suppliedId,
  labelId, className = "", disabled = false, required = false, name, variant, "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy }) {
  const generatedId = useId();
  const id = suppliedId || `select-${generatedId.replace(/:/g, "")}`;
  const options = useMemo(() => suppliedOptions || React.Children.toArray(children).filter(React.isValidElement).map((child) => ({
    value: String(child.props.value ?? child.props.children), label: child.props.children,
    disabled: !!child.props.disabled, hidden: !!child.props.hidden,
  })), [children, suppliedOptions]);
  const visible = options.filter((option) => !option.hidden);
  const selected = options.find((option) => String(option.value) === String(value)) || options[0];
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ above: false, height: 280, left: 0, width: 0, edge: 0 });
  const root = useRef(null), trigger = useRef(null), list = useRef(null);
  const typed = useRef({ text: "", time: 0 });
  const listId = `${id}-options`;
  const statusVariant = variant === "status";

  const placeMenu = useCallback(() => {
    const bounds = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 12, above = bounds.top - 12;
    const flip = below < Math.min(280, window.innerHeight * 0.45) && above > below;
    const width = Math.min(bounds.width, window.innerWidth - 16);
    setPlacement({ above: flip, height: Math.max(44, Math.min(280, flip ? above : below)), width,
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
      edge: flip ? window.innerHeight - bounds.top + 6 : bounds.bottom + 6 });
  }, []);

  const focusOption = useCallback((index, direction = 1) => {
    const items = Array.from(list.current?.children || []);
    for (let step = 0; step < items.length; step += 1) {
      const candidate = items[(index + step * direction + items.length) % items.length];
      if (candidate.getAttribute("aria-disabled") === "true") continue;
      candidate.focus({ preventScroll: true });
      if (candidate.offsetTop < list.current.scrollTop) list.current.scrollTop = candidate.offsetTop;
      else if (candidate.offsetTop + candidate.offsetHeight > list.current.scrollTop + list.current.clientHeight) {
        list.current.scrollTop = candidate.offsetTop + candidate.offsetHeight - list.current.clientHeight;
      }
      break;
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const items = Array.from(list.current?.children || []);
    focusOption(Math.max(0, items.findIndex((item) => item.getAttribute("aria-selected") === "true")));
    const outside = (event) => {
      if (!root.current?.contains(event.target) && !list.current?.contains(event.target)) setOpen(false);
    };
    const reposition = (event) => { if (!list.current?.contains(event.target)) placeMenu(); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, focusOption, placeMenu]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const choose = (option) => {
    if (option.disabled) return;
    onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } });
    close();
  };

  return <div ref={root} className={`responsive-select${className ? ` ${className.split(" ")[0]}-wrapper` : ""}${statusVariant ? " my-reports-status-picker" : ""}`}
    onBlur={(event) => {
      if (!root.current?.contains(event.relatedTarget) && !list.current?.contains(event.relatedTarget)) setOpen(false);
    }}>
    <button ref={trigger} id={id} value={value ?? ""} type="button" role="combobox" aria-labelledby={labelId}
      aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      aria-required={required || undefined} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} disabled={disabled}
      className={`responsive-select-trigger ${className}${statusVariant ? " my-reports-filter-trigger" : ""}`}
      onClick={() => { if (!open) placeMenu(); setOpen(!open); }}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); placeMenu(); setOpen(true); }
        else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
      }}>
      <span>{selected?.label || "Select an option"}</span>
      <span aria-hidden="true" className={`responsive-select-chevron${open ? " is-open" : ""}`} />
    </button>
    {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    {open && !disabled ? createPortal(<ul ref={list} id={listId} role="listbox" aria-labelledby={labelId}
      aria-label={labelId ? undefined : ariaLabel || "Options"}
      className={`responsive-select-menu${statusVariant ? " my-reports-filter-menu" : ""}${placement.above ? " opens-above" : ""}`}
      style={{ position: "fixed", left: placement.left, width: placement.width, maxHeight: placement.height,
        top: placement.above ? "auto" : placement.edge, bottom: placement.above ? placement.edge : "auto" }}>
      {visible.map((option, index) => <li key={`${option.value}-${index}`} role="option"
        aria-selected={String(option.value) === String(value)} aria-disabled={option.disabled || undefined} tabIndex={-1}
        className={`responsive-select-option${statusVariant ? " my-reports-filter-option" : ""}`}
        onClick={() => choose(option)} onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault(); const direction = event.key === "ArrowDown" ? 1 : -1;
            focusOption((index + direction + visible.length) % visible.length, direction);
          } else if (["Home", "End"].includes(event.key)) {
            event.preventDefault(); focusOption(event.key === "Home" ? 0 : visible.length - 1, event.key === "Home" ? 1 : -1);
          } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(option); }
          else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
          else if (event.key === "Tab") close();
          else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            typed.current.text = Date.now() - typed.current.time > 700 ? event.key : typed.current.text + event.key;
            typed.current.time = Date.now();
            const match = visible.findIndex((item) => !item.disabled && String(item.label).toLowerCase().startsWith(typed.current.text.toLowerCase()));
            if (match >= 0) { event.preventDefault(); focusOption(match); }
          }
        }}><span>{option.label}</span><span aria-hidden="true">{String(option.value) === String(value) ? "\u2713" : ""}</span></li>)}
    </ul>, document.body) : null}
  </div>;
}
