"use client";

import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/admin/fields";
import { Input } from "@/components/ui/form-controls";

/**
 * O vi do / kinh do (latitude, longitude). Dan ca chuoi "21.0278, 105.8342" vao mot o
 * se tu tach ra hai o. Canh bao khi toa do nam ngoai Viet Nam (thuong do nhap nguoc).
 */
export function CoordinateFields({ latitude, longitude, errors }: { latitude: string; longitude: string; errors: { latitude?: string; longitude?: string } }) {
  const [lat, setLat] = useState(latitude);
  const [lng, setLng] = useState(longitude);

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const m = e.clipboardData.getData("text").match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return;
    e.preventDefault();
    setLat(m[1]);
    setLng(m[2]);
  };

  const la = Number(lat);
  const lo = Number(lng);
  const both = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(la) && Number.isFinite(lo);
  const outside = both && !(la >= 8 && la <= 24 && lo >= 102 && lo <= 110);

  return (
    <div className="grid gap-3">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vĩ độ (latitude)" error={errors.latitude}>
          <Input name="latitude" value={lat} onChange={(e) => setLat(e.target.value)} onPaste={onPaste} placeholder="21.0278" autoComplete="off" inputMode="decimal" aria-invalid={Boolean(errors.latitude)} />
        </Field>
        <Field label="Kinh độ (longitude)" error={errors.longitude}>
          <Input name="longitude" value={lng} onChange={(e) => setLng(e.target.value)} onPaste={onPaste} placeholder="105.8342" autoComplete="off" inputMode="decimal" aria-invalid={Boolean(errors.longitude)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {outside && (
          <span className="flex items-center gap-1 text-amber-700">
            <TriangleAlertIcon className="size-3.5" /> Tọa độ nằm ngoài Việt Nam (vĩ độ 8–24, kinh độ 102–110) — có thể đã nhập ngược hai ô.
          </span>
        )}
        {both && (
          <a href={`https://www.google.com/maps?q=${la},${lo}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLinkIcon className="size-3.5" /> Xem vị trí trên Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
