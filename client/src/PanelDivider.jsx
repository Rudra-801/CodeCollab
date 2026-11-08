import React, {useRef} from "react";

export default function PanelDivider({label, value, onChange, reverse = false}) {
  const start = useRef(null);
  const adjust = delta => onChange(Math.min(30, Math.max(12, value + delta)));
  return <div role="separator" aria-label={label} aria-orientation="vertical"
    aria-valuenow={Math.round(value)} aria-valuemin={12} aria-valuemax={30}
    aria-valuetext={Math.round(value) + " percent"} className="panel-divider" tabIndex={0}
    onKeyDown={event=>{
      if (!["ArrowLeft","ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      adjust((event.key === "ArrowRight" ? 1 : -1) * (reverse ? -1 : 1));
    }}
    onPointerDown={event=>{
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current={x:event.clientX,width:event.currentTarget.parentElement.clientWidth,initial:value};
    }}
    onPointerMove={event=>{
      if (!start.current) return;
      const delta=100*(event.clientX-start.current.x)/start.current.width;
      onChange(Math.min(30, Math.max(12,start.current.initial+delta*(reverse?-1:1))));
    }}
    onLostPointerCapture={()=>{start.current=null;}} />;
}
