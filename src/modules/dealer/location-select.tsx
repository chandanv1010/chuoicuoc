"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Field } from "@/components/admin/fields";
import { Combobox } from "@/components/ui/combobox";

/**
 * Tinh/Thanh -> Quan/Huyen -> Phuong/Xa (thay location.js + bien province_id/district_id/ward_id).
 * Goi GET ajax/location/getLocation?target=districts|wards&data[location_id]=<code> (tra {html: "<option>..."}).
 * Gui province_code / district_code / ward_code; muc "[Chon ...]" gui chuoi rong (ban jQuery gui "0").
 */
type Opt = { value: string; label: string };

async function loadOptions(target: "districts" | "wards", code: string): Promise<Opt[]> {
  const qs = new URLSearchParams({ target, "data[location_id]": code });
  const res = await fetch(`/ajax/location/getLocation?${qs}`, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const { html } = (await res.json()) as { html: string };
  const doc = new DOMParser().parseFromString(`<select>${html}</select>`, "text/html");
  return [...doc.querySelectorAll("option")].filter((o) => o.value !== "0" && o.value !== "").map((o) => ({ value: o.value, label: o.textContent ?? o.value }));
}

export function LocationSelect({ provinces, province, district, ward }: { provinces: Opt[]; province: string; district: string; ward: string }) {
  const [p, setP] = useState(provinces.some((x) => x.value === province) ? province : "");
  const [d, setD] = useState(district);
  const [w, setW] = useState(ward);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const [wards, setWards] = useState<Opt[]>([]);
  const [loading, setLoading] = useState<"" | "districts" | "wards">("");

  useEffect(() => {
    let alive = true;
    if (!p) {
      setDistricts([]);
      return;
    }
    setLoading("districts");
    loadOptions("districts", p)
      .then((list) => alive && setDistricts(list))
      .finally(() => alive && setLoading(""));
    return () => {
      alive = false;
    };
  }, [p]);

  useEffect(() => {
    let alive = true;
    if (!d) {
      setWards([]);
      return;
    }
    setLoading("wards");
    loadOptions("wards", d)
      .then((list) => alive && setWards(list))
      .finally(() => alive && setLoading(""));
    return () => {
      alive = false;
    };
  }, [d]);

  const spin = (k: string) => (loading === k ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : undefined);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Tỉnh / Thành">
        <Combobox
          name="province_code"
          value={p}
          onChange={(v) => {
            setP(v);
            setD("");
            setW("");
          }}
          options={[{ value: "", label: "[Chọn Tỉnh/Thành]" }, ...provinces]}
          placeholder="[Chọn Tỉnh/Thành]"
        />
      </Field>
      <Field label="Quận / Huyện" aside={spin("districts")}>
        <Combobox
          name="district_code"
          value={districts.some((x) => x.value === d) || loading === "districts" ? d : ""}
          onChange={(v) => {
            setD(v);
            setW("");
          }}
          options={[{ value: "", label: "[Chọn Quận/Huyện]" }, ...districts]}
          placeholder="[Chọn Quận/Huyện]"
          disabled={!p}
        />
      </Field>
      <Field label="Phường / Xã" aside={spin("wards")}>
        <Combobox
          name="ward_code"
          value={wards.some((x) => x.value === w) || loading === "wards" ? w : ""}
          onChange={setW}
          options={[{ value: "", label: "[Chọn Phường/Xã]" }, ...wards]}
          placeholder="[Chọn Phường/Xã]"
          disabled={!d}
        />
      </Field>
    </div>
  );
}
