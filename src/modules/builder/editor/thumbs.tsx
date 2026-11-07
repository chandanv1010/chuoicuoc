"use client";

/**
 * Hinh minh hoa nho (wireframe) cho thu vien kieu the / mau section — chi la khoi mau, khong render that,
 * de bang Chen va inspector nhe va nhin la biet bo cuc.
 */

const IMG = "bg-[#d9cfbf]";
const BAR = "rounded-full bg-[#b9ae9c]";
const LINE = "rounded-full bg-[#ddd4c6]";

function Pastel() {
  return (
    <div className="grid h-full grid-cols-3 gap-1">
      {["#f6dccf", "#e3e8d6", "#dbe6ea"].map((c) => (
        <div key={c} className="flex flex-col overflow-hidden rounded" style={{ background: c }}>
          <div className="space-y-0.5 p-1">
            <div className={`h-1.5 w-4/5 ${BAR}`} />
            <div className={`h-1 w-3/5 ${LINE}`} />
          </div>
          <div className={`mt-auto h-1/2 ${IMG}`} />
        </div>
      ))}
    </div>
  );
}
function Tile() {
  return (
    <div className="grid h-full grid-cols-4 gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-0.5 rounded bg-[#f3ede3] p-0.5">
          <div className={`aspect-[4/3] rounded-sm ${IMG}`} />
          <div className={`h-1 w-4/5 ${BAR}`} />
          <div className={`h-1 w-1/2 ${LINE}`} />
        </div>
      ))}
    </div>
  );
}
function Overlay({ cols = 3 }: { cols?: number }) {
  return (
    <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className={`relative overflow-hidden rounded ${IMG}`}>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="absolute bottom-1 left-1 h-1.5 w-1/2 rounded-full bg-white/90" />
        </div>
      ))}
    </div>
  );
}
function Circle() {
  return (
    <div className="flex h-full items-center justify-between px-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div className={`size-6 rounded-full ${IMG}`} />
          <div className={`h-1 w-5 ${BAR}`} />
        </div>
      ))}
    </div>
  );
}
function Pill() {
  return (
    <div className="flex h-full flex-wrap content-center gap-1">
      {[10, 14, 8, 12, 9].map((w, i) => (
        <div key={i} className="h-3 rounded-full border border-[#cfc4b2] bg-white px-1">
          <div className={`mt-[3px] h-1 ${BAR}`} style={{ width: w }} />
        </div>
      ))}
    </div>
  );
}
function List() {
  return (
    <div className="flex h-full flex-col justify-center divide-y divide-[#e2d9cb]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <div className={`h-1.5 w-1/2 ${BAR}`} />
          <div className={`h-1 w-3 ${LINE}`} />
        </div>
      ))}
    </div>
  );
}
function ProductCards({ boxed, cols = 4 }: { boxed?: boolean; cols?: number }) {
  return (
    <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className={`flex flex-col gap-0.5 rounded ${boxed ? "bg-white p-0.5 shadow-[0_1px_2px_rgba(0,0,0,.15)]" : ""}`}>
          <div className={`aspect-[4/5] rounded-sm ${IMG}`} />
          <div className={`h-1 w-4/5 ${LINE}`} />
          <div className={`h-1.5 w-2/5 ${BAR}`} />
        </div>
      ))}
    </div>
  );
}
function Horizontal() {
  return (
    <div className="grid h-full grid-cols-2 gap-1">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-1 rounded bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,.15)]">
          <div className={`size-7 shrink-0 rounded-sm ${IMG}`} />
          <div className="flex-1 space-y-0.5">
            <div className={`h-1 w-4/5 ${LINE}`} />
            <div className={`h-1.5 w-1/2 ${BAR}`} />
            <div className="h-1.5 w-1/3 rounded-full bg-[#c8553d]/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
function Posts() {
  return (
    <div className="grid h-full grid-cols-3 gap-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div className={`aspect-[16/10] rounded-sm ${IMG}`} />
          <div className={`h-1.5 w-4/5 ${BAR}`} />
          <div className={`h-1 w-full ${LINE}`} />
          <div className={`h-1 w-2/3 ${LINE}`} />
        </div>
      ))}
    </div>
  );
}
function Hero2() {
  return (
    <div className="flex h-full items-center gap-2 rounded bg-[#fbf7f0] p-1.5">
      <div className="flex-1 space-y-1">
        <div className={`h-2 w-full ${BAR}`} />
        <div className={`h-1 w-4/5 ${LINE}`} />
        <div className="h-2 w-1/2 rounded-full bg-[#c8553d]/80" />
      </div>
      <div className={`h-full flex-1 rounded ${IMG}`} />
    </div>
  );
}
function Banner() {
  return (
    <div className={`relative h-full overflow-hidden rounded ${IMG}`}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute top-1/2 left-2 -translate-y-1/2 space-y-1">
        <div className="h-2 w-16 rounded-full bg-white/90" />
        <div className="h-2 w-8 rounded-full bg-[#e9b04a]" />
      </div>
      <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
        <div className="h-1 w-2.5 rounded-full bg-white" />
        <div className="size-1 rounded-full bg-white/60" />
      </div>
    </div>
  );
}
function Features() {
  return (
    <div className="grid h-full grid-cols-3 gap-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-0.5 rounded bg-[#f4efe6] p-1">
          <div className="size-2 rounded-sm bg-[#c8553d]/80" />
          <div className={`h-1.5 w-4/5 ${BAR}`} />
          <div className={`h-1 w-full ${LINE}`} />
        </div>
      ))}
    </div>
  );
}
function Cta() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded bg-[#1f3a33]">
      <div className="h-2 w-2/3 rounded-full bg-white/85" />
      <div className="h-1 w-1/2 rounded-full bg-white/50" />
      <div className="h-2 w-1/4 rounded-full bg-[#e9b04a]" />
    </div>
  );
}
function Quotes() {
  return (
    <div className="grid h-full grid-cols-3 gap-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-0.5 rounded bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,.12)]">
          <div className="text-[8px] leading-none text-[#e0a526]">★★★★★</div>
          <div className={`h-1 w-full ${LINE}`} />
          <div className={`h-1 w-3/4 ${LINE}`} />
          <div className={`h-1 w-1/2 ${BAR}`} />
        </div>
      ))}
    </div>
  );
}

const THUMBS: Record<string, () => React.ReactNode> = {
  "categories:pastel": Pastel,
  "categories:tile": Tile,
  "categories:overlay": () => <Overlay />,
  "categories:circle": Circle,
  "categories:pill": Pill,
  "categories:list": List,
  "products:white": () => <ProductCards boxed />,
  "products:minimal": () => <ProductCards cols={5} />,
  "products:overlay": () => <Overlay />,
  "products:horizontal": Horizontal,
  "posts:classic": Posts,
  "posts:overlay": () => <Overlay />,
  "section:hero2": Hero2,
  "section:bannerSlider": Banner,
  "section:features3": Features,
  "section:cta": Cta,
  "section:testimonials": Quotes,
};

export function DesignThumb({ id }: { id: string }) {
  const T = THUMBS[id];
  return <div className="h-14 w-full overflow-hidden rounded-md bg-[#faf7f2] p-1.5">{T ? <T /> : null}</div>;
}
