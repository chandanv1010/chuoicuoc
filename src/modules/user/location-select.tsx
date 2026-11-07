"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/admin/fields";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

/**
 * Chon Tinh / Huyen / Xa (thay location.js + select2): goi GET ajax/location/getLocation
 * (target=districts|wards, data[location_id]) -> { html: "<option ...>" } roi doc lai thanh danh sach.
 * Gui province_id, district_id, ward_id nhu form cu ("0" khi chua chon).
 */
function parseOptions(html: string): ComboOption[] {
  const out: ComboOption[] = [];
  const re = /<option value="([^"]*)">([^<]*)<\/option>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ value: m[1], label: m[2] });
  return out;
}

async function load(target: "districts" | "wards", id: string): Promise<ComboOption[]> {
  if (!id || id === "0") return [];
  const res = await fetch(`/ajax/location/getLocation?${new URLSearchParams({ target, "data[location_id]": id })}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { html?: string };
  return parseOptions(json.html ?? "").filter((o) => o.value !== "0");
}

export function LocationSelect({
  provinces,
  defaults,
}: {
  provinces: { code: string; name: string }[];
  defaults: { province_id: string; district_id: string; ward_id: string };
}) {
  const [province, setProvince] = useState(defaults.province_id || "0");
  const [district, setDistrict] = useState(defaults.district_id || "0");
  const [ward, setWard] = useState(defaults.ward_id || "0");
  const [districts, setDistricts] = useState<ComboOption[]>([]);
  const [wards, setWards] = useState<ComboOption[]>([]);

  useEffect(() => {
    let alive = true;
    load("districts", province).then((list) => alive && setDistricts(list));
    return () => {
      alive = false;
    };
  }, [province]);

  useEffect(() => {
    let alive = true;
    load("wards", district).then((list) => alive && setWards(list));
    return () => {
      alive = false;
    };
  }, [district]);

  const provinceOptions = [{ value: "0", label: "[Chọn Thành Phố]" }, ...provinces.map((p) => ({ value: p.code, label: p.name }))];

  return (
    <>
      <Field label="Thành phố">
        <Combobox
          name="province_id"
          value={province}
          options={provinceOptions}
          onChange={(v) => {
            setProvince(v || "0");
            setDistrict("0");
            setWard("0");
          }}
        />
      </Field>
      <Field label="Quận / Huyện">
        <Combobox
          name="district_id"
          value={district}
          options={[{ value: "0", label: "[Chọn Quận/Huyện]" }, ...districts]}
          onChange={(v) => {
            setDistrict(v || "0");
            setWard("0");
          }}
          disabled={province === "0"}
        />
      </Field>
      <Field label="Phường / Xã">
        <Combobox
          name="ward_id"
          value={ward}
          options={[{ value: "0", label: "[Chọn Phường/Xã]" }, ...wards]}
          onChange={(v) => setWard(v || "0")}
          disabled={district === "0"}
        />
      </Field>
    </>
  );
}
