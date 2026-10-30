import React, { useEffect, useId, useRef, useState } from "react";
import "./ViolationGuide.css";

export const VIOLATION_GUIDE = [
  { value: "Arrogant Driver / Discourteous", title: "Discourteous driver", scene: "discourteous", description: "Drayber nga nag-insulto, nanghadlok, o dili maayong pagtagad sa pasahero o ubang tawo." },
  { value: "No Parking / Wrong Parking", title: "Illegal / wrong parking", scene: "parking", description: "Sakyanan nga giparada sa bawal nga lugar, sidewalk, o atubangan sa agianan." },
  { value: "No U-Turn / Illegal Turn", title: "Illegal turn / U-turn", scene: "turn", description: "Pagliko o pag-U-turn sa lugar nga adunay karatulang nagdili niini." },
  { value: "Involved in Traffic Accident", title: "Traffic accident", scene: "accident", description: "Bangga o insidente sa dalan nga nalambigit ang sakyanan, tawo, o kabtangan." },
  { value: "No Muffler / Silencer", title: "No muffler / silencer", scene: "muffler", description: "Sakyanan nga walay muffler o silencer, o gitangtangan niini nga maoy hinungdan sa kusog nga saba." },
  { value: "Obstruction", title: "Road obstruction", scene: "obstruction", description: "Sakyanan o butang nga nagbabag sa dalan ug nakapalisod sa pag-agi sa uban." },
  { value: "Driving Under the Influence of Liquor", title: "Suspected drunk driving", scene: "alcohol", description: "Pagmaneho nga gidudahang naimpluwensiyahan sa alkohol. Isulat ang mga lihok nga imong nakita." },
  { value: "Wearing Slipper / Sleeveless & Shorts", title: "Slippers / sleeveless / shorts", scene: "clothing", description: "I-report dinhi ang drayber nga nagsul-ob og tsinelas, sleeveless, o shorts; CTMO ang mosusi sa angay nga lagda." },
  { value: "Failure / Or No Crash Helmet (R.A. 4136)", title: "No motorcycle helmet", scene: "helmet", description: "Drayber o angkas sa motorsiklo nga wala nagsul-ob og protective motorcycle helmet." },
  { value: "No Seatbelt (R.A. 8750)", title: "No seat belt", scene: "seatbelt", description: "Drayber o pasahero nga wala nag-seat belt sa lingkoranan nga gikinahanglan kini." },
  { value: "Illegal Terminal (Ord. #134 S, '98)", title: "Unauthorized terminal", scene: "terminal", description: "Lugar nga gigamit nga terminal o hulatanan sa mga sakyanan nga walay hustong pagtugot." },
  { value: "Non Payment of Terminal Fee (Ord. #134 S, '98)", title: "Unpaid terminal fee", scene: "fee", description: "Wala mabayri ang gikinahanglang terminal fee. Ilakip ang nahibal-an nimong detalye sa bayranan." },
  { value: "Driving W/Out a License / Unaccompanied by Licensed Driver", title: "License / learner supervision", scene: "license", description: "Pagmaneho nga walay hustong lisensya, o student driver nga walay licensed driver nga kauban." },
  { value: "Deffective Signal / Break / Tail Lights", title: "Defective vehicle lights", scene: "lights", description: "Signal, brake light, o tail light nga guba o dili mosiga sa hustong higayon." },
  { value: "No Loading / No Unloading", title: "Loading in a prohibited area", scene: "loading", description: "Pagpasakay, pagpanaog, o pagkarga sa lugar nga adunay No Loading / No Unloading nga karatula." },
  { value: "Allowing Passenger on Top of MV", title: "Passenger on vehicle roof", scene: "roof", description: "Pagpasakay og tawo sa atop sa motor vehicle imbis sa hustong lingkoranan." },
  { value: "Other Violation/s (Specify)", title: "Other road concern", scene: "other", description: "Kung wala sa lista ang imong nakita, pilia kini ug ipasabot og klaro sa Description." },
];

function Car({ x = 44, y = 59, color = "#2878bf", rotate = 0 }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate} 34 17)`}>
    <path d="M3 17 12 4h35l12 13 7 3v17H0V22Z" fill={color} />
    <path d="m16 8-6 10h40L43 8Z" fill="#d9f2ff" /><path d="M29 8v10" stroke="#14548c" strokeWidth="3" />
    <rect x="57" y="24" width="8" height="5" rx="2" fill="#ffe28a" />
    <circle cx="14" cy="36" r="8" fill="#24384d" /><circle cx="53" cy="36" r="8" fill="#24384d" />
    <circle cx="14" cy="36" r="3" fill="#a9bed1" /><circle cx="53" cy="36" r="3" fill="#a9bed1" />
  </g>;
}
function Person({ x = 110, y = 45, shirt = "#e69738" }) {
  return <g transform={`translate(${x} ${y})`} strokeLinecap="round">
    <circle cx="0" cy="0" r="7" fill="#bd855f" /><path d="M-6 12 0 9l7 3 4 21H-10Z" fill={shirt} />
    <path d="m-4 32-4 18m13-18 5 18M-7 15l-12 15m25-15 12 12" fill="none" stroke="#31475d" strokeWidth="5" />
  </g>;
}
function Prohibited({ x = 134, y = 30, children }) {
  return <g transform={`translate(${x} ${y})`}><circle r="20" fill="white" stroke="#db4250" strokeWidth="4" />{children}
    <path d="m-14 14 28-28" stroke="#db4250" strokeWidth="4" /></g>;
}
function Cross({ x, y }) {
  return <g stroke="#d83549" strokeWidth="5" strokeLinecap="round"><path d={`m${x - 6} ${y - 6} 12 12m0-12-12 12`} /></g>;
}
function Rider() {
  return <><circle cx="52" cy="91" r="14" fill="none" stroke="#31475d" strokeWidth="5" /><circle cx="115" cy="91" r="14" fill="none" stroke="#31475d" strokeWidth="5" />
    <path d="m53 89 18-28h23l20 29H74l-16-9m39-26 12-8h9" fill="none" stroke="#2878bf" strokeWidth="7" strokeLinejoin="round" />
    <circle cx="84" cy="32" r="10" fill="#bd855f" /><path d="m83 46-10 17 16 11 8 15m-14-39 20 7" fill="none" stroke="#e69738" strokeWidth="8" strokeLinecap="round" /></>;
}

function Illustration({ scene, title }) {
  return <svg viewBox="0 0 180 120" role="img" aria-label={`Illustration: ${title}`} className={`vg-picture vg-picture-${scene}`}>
    <rect width="180" height="120" rx="12" fill="#edf5fc" />
    <path d="M0 83h180v37H0Z" fill="#d1dce9" /><path d="M10 108h26m14 0h26m14 0h26m14 0h26" stroke="white" strokeWidth="3" />
    <path d="M12 81V44h24v37m108 0V53h24v28" fill="#dce9f2" />
    {scene === "parking" ? <><Car x={25} /><path d="M132 47v43" stroke="#7289a1" strokeWidth="4" /><Prohibited><text x="-7" y="8" fill="#304d68" fontSize="24" fontWeight="700">P</text></Prohibited></> : null}
    {scene === "turn" ? <><Car x={24} y={63} /><Prohibited x={123} y={34}><path d="M7 11V-4a7 7 0 0 0-14 0v8m-5-5 5 6 5-6" fill="none" stroke="#304d68" strokeWidth="3" /></Prohibited></> : null}
    {scene === "accident" ? <><Car x={9} y={60} rotate={-12} /><Car x={105} y={62} color="#db6570" rotate={15} /><path d="m82 50 6 13 8-16 2 19 14-6-11 14" fill="#ffd86b" stroke="#df9c27" strokeWidth="2" /></> : null}
    {scene === "obstruction" ? <><Car x={9} y={61} /><rect x="95" y="68" width="69" height="12" rx="2" fill="#e9a442" /><path d="m103 68 9 12m9-12 9 12m9-12 9 12m-43 0v18m49-18v18" stroke="#334e66" strokeWidth="4" /></> : null}
    {scene === "muffler" ? <><Car x={80} /><path d="M77 84H64m-8-7q-8 6 0 12m-11-19q-15 14 0 27m-13-33q-20 20 0 39" fill="none" stroke="#d4843b" strokeWidth="4" strokeLinecap="round" /><Cross x={63} y={66} /></> : null}
    {scene === "discourteous" ? <><Car x={12} /><Person x={123} y={48} /><path d="M92 14h57a7 7 0 0 1 7 7v19h-23l-9 9v-9H92Z" fill="white" stroke="#a7bfd5" /><text x="106" y="34" fontSize="18" fontWeight="800" fill="#c34550">! !</text></> : null}
    {scene === "alcohol" ? <><Car x={18} /><g transform="translate(127 15) rotate(14)"><path d="M-5 0H5v14l7 8v31h-24V22l7-8Z" fill="#54876f" /><rect x="-12" y="30" width="24" height="15" fill="#fff0c5" /></g><Prohibited x={132} y={68} /></> : null}
    {scene === "helmet" ? <><Rider /><path d="M73 18q9-10 22 1" stroke="#d34251" strokeWidth="3" strokeDasharray="3 3" fill="none" /><Cross x={125} y={28} /></> : null}
    {scene === "seatbelt" ? <><rect x="53" y="17" width="74" height="86" rx="20" fill="#a1b7cc" /><Person x={89} y={41} shirt="#2878bf" /><path d="m65 42 48 48" stroke="white" strokeWidth="7" strokeDasharray="8 5" /><Cross x={131} y={30} /></> : null}
    {scene === "clothing" ? <><path d="m28 27 13 7 12-7 9 14-5 8-6-5v25H31V44l-6 5-6-8Z" fill="#66a1cb" /><path d="M75 37h36l-2 34H96l-4-19-4 19H74Z" fill="#395977" /><g transform="translate(135 44) rotate(20)"><ellipse cy="11" rx="11" ry="24" fill="#e7a447" /><path d="M0 4v-12M0 4l-8 9m8-9 8 9" stroke="#805d31" strokeWidth="3" /></g></> : null}
    {scene === "terminal" ? <><Car x={19} y={63} /><Person x={107} y={52} /><path d="M139 41v51" stroke="#7289a1" strokeWidth="4" /><Prohibited x={139} y={26}><text x="-7" y="8" fill="#304d68" fontSize="23" fontWeight="700">T</text></Prohibited></> : null}
    {scene === "fee" ? <><Car x={12} y={65} /><path d="M105 15h43v63l-6-5-5 5-5-5-5 5-5-5-5 5-6-5-6 5Z" fill="white" stroke="#afc3d7" strokeWidth="2" /><text x="118" y="44" fill="#457269" fontSize="23">₱</text><path d="M115 54h22m-22 8h13" stroke="#afc3d7" strokeWidth="3" /><Cross x={153} y={71} /></> : null}
    {scene === "license" ? <><Car x={21} y={67} /><rect x="73" y="15" width="79" height="47" rx="6" fill="white" stroke="#aac2d8" strokeWidth="2" /><circle cx="93" cy="32" r="7" fill="#7ca5c7" /><path d="M83 48q10-17 20 0m9-19h26m-26 10h20m-20 10h15" stroke="#7ca5c7" strokeWidth="3" fill="none" /><Cross x={151} y={64} /></> : null}
    {scene === "lights" ? <><rect x="49" y="28" width="80" height="69" rx="12" fill="#2878bf" /><rect x="58" y="37" width="62" height="26" rx="5" fill="#d9f2ff" /><rect x="49" y="72" width="17" height="12" fill="#ee777b" /><rect x="112" y="72" width="17" height="12" fill="#65798f" /><path d="M57 97v9m64-9v9" stroke="#31475d" strokeWidth="11" /><Cross x={139} y={77} /></> : null}
    {scene === "loading" ? <><Car x={12} y={64} /><Person x={101} y={49} /><Prohibited x={145} y={30}><path d="M-12 0h23m-6-6 6 6-6 6" stroke="#304d68" strokeWidth="3" fill="none" /></Prohibited></> : null}
    {scene === "roof" ? <><Car x={45} y={65} /><Person x={76} y={22} /><path d="M110 22h17" stroke="#d34251" strokeWidth="3" /><Cross x={138} y={27} /></> : null}
    {scene === "other" ? <><Car x={20} y={62} /><circle cx="132" cy="35" r="24" fill="white" stroke="#aac2d8" strokeWidth="2" /><text x="123" y="45" fontSize="30" fontWeight="800" fill="#2878bf">?</text></> : null}
  </svg>;
}

export default function ViolationGuide({ value, onSelect }) {
  const pageSize = 3;
  const pageCount = Math.ceil(VIOLATION_GUIDE.length / pageSize);
  const [page, setPage] = useState(() => Math.max(0, Math.floor(VIOLATION_GUIDE.findIndex((item) => item.value === value) / pageSize)));
  const viewport = useRef(null);
  const touch = useRef(null);
  const swiped = useRef(false);
  const guideId = useId();
  const visible = VIOLATION_GUIDE.slice(page * pageSize, (page + 1) * pageSize);
  const selected = VIOLATION_GUIDE.find((item) => item.value === value);
  useEffect(() => {
    const index = VIOLATION_GUIDE.findIndex((item) => item.value === value);
    if (index >= 0) setPage(Math.floor(index / pageSize));
  }, [value]);
  const moveTo = (next) => setPage(Math.max(0, Math.min(pageCount - 1, next)));
  return <section className="vg" aria-labelledby={`${guideId}-title`} aria-roledescription="carousel">
    <div className="vg-heading"><div><h3 id={`${guideId}-title`}>Know the violation</h3>
      <p>Review the image and description. Select a card, or browse more types using the arrows.</p></div><span className="vg-count">{VIOLATION_GUIDE.length} types</span></div>
    <div ref={viewport} id={`${guideId}-slides`} className="vg-viewport" role="group" tabIndex={0} aria-label="Violation examples"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        moveTo(event.key === "Home" ? 0 : event.key === "End" ? pageCount - 1 : page + (event.key === "ArrowRight" ? 1 : -1));
        viewport.current?.focus({ preventScroll: true });
      }}
      onTouchStart={(event) => {
        swiped.current = false;
        touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={(event) => {
        const start = touch.current, end = event.changedTouches[0];
        touch.current = null;
        if (!start || !end) return;
        const distance = end.clientX - start.x;
        if (Math.abs(distance) >= 50 && Math.abs(distance) > Math.abs(end.clientY - start.y) * 1.4) {
          swiped.current = true; moveTo(page + (distance < 0 ? 1 : -1));
        }
      }}
      onClickCapture={(event) => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; } }}>
    <div key={page} className="vg-grid vg-slide" role="group" aria-roledescription="slide" aria-label={`Slide ${page + 1} of ${pageCount}`}>
      {visible.map((item) => <button type="button" key={item.value}
      className={`vg-card${value === item.value ? " is-selected" : ""}`} aria-pressed={value === item.value}
      aria-label={`Select ${item.title}`} onClick={() => onSelect(item.value)}>
      <Illustration scene={item.scene} title={item.title} />
      <span className="vg-card-title">{item.title}</span><span className="vg-card-description">{item.description}</span>
      <span className="vg-card-action">{value === item.value ? "Selected ✓" : "Select violation →"}</span>
    </button>)}</div></div>
    <div className="vg-controls" role="group" aria-label="Violation carousel controls">
      <button type="button" className="vg-arrow" aria-label="Previous violation types" aria-controls={`${guideId}-slides`}
        disabled={page === 0} onClick={() => moveTo(page - 1)}><span aria-hidden="true">←</span></button>
      <div className="vg-pagination-wrap"><div className="vg-pagination" aria-label="Choose a slide">
        {Array.from({ length: pageCount }, (_, index) => <button type="button" key={index} className="vg-dot"
          aria-label={`Go to slide ${index + 1}`} aria-current={page === index ? "true" : undefined}
          aria-controls={`${guideId}-slides`} onClick={() => moveTo(index)}><span /></button>)}
      </div><span className="vg-slide-count" aria-live="polite" aria-atomic="true">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, VIOLATION_GUIDE.length)} of {VIOLATION_GUIDE.length} types</span></div>
      <button type="button" className="vg-arrow" aria-label="Next violation types" aria-controls={`${guideId}-slides`}
        disabled={page === pageCount - 1} onClick={() => moveTo(page + 1)}><span aria-hidden="true">→</span></button>
    </div>
    {selected ? <p className="vg-selected" role="status"><strong>Selected: {selected.title}.</strong></p> : null}
    <p className="vg-caption">Illustrated examples to help you choose. CTMO reviews the report and confirms the applicable violation.</p>
  </section>;
}
