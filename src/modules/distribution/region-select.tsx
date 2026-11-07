"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/admin/fields";
import { NativeSelect } from "@/components/ui/form-controls";

/**
 * Mien (province_id) -> Tinh/Thanh (district_id): thay script inline cua distribution/store.blade.php
 * (nap danh sach qua GET distribution/area/getArea?parent_id=...).
 */
type Area = { id: string; name: string };

export function RegionAreaSelect({
  regions,
  areas,
  provinceId,
  districtId,
  errors,
}: {
  regions: Area[];
  areas: Area[];
  provinceId: string;
  districtId: string;
  errors: { province_id?: string; district_id?: string };
}) {
  const [region, setRegion] = useState(regions.some((r) => r.id === provinceId) ? provinceId : "0");
  const [list, setList] = useState(areas);
  const [district, setDistrict] = useState(districtId);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (region === "0") {
      setList([]);
      setDistrict("0");
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/distribution/area/getArea?parent_id=${encodeURIComponent(region)}`, { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((rows: { id: number; name: string }[]) => {
        if (!alive) return;
        setList(rows.map((r) => ({ id: String(r.id), name: r.name })));
        setDistrict("0");
      })
      .catch(() => alive && setList([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [region]);

  return (
    <>
      <Field label="Miền" required error={errors.province_id}>
        <NativeSelect name="province_id" value={region} onChange={(e) => setRegion(e.target.value)} aria-invalid={Boolean(errors.province_id)}>
          <option value="0">Chọn Miền (Phía Bắc / Phía Nam)</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Tỉnh / Thành phố" required error={errors.district_id} aside={loading ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : undefined}>
        <NativeSelect
          name="district_id"
          value={list.some((a) => a.id === district) ? district : "0"}
          onChange={(e) => setDistrict(e.target.value)}
          disabled={loading}
          aria-invalid={Boolean(errors.district_id)}
        >
          <option value="0">{region === "0" ? "Chọn miền trước" : "Chọn Tỉnh / Thành phố"}</option>
          {list.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}
