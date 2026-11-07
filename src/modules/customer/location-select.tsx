"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Field } from "@/components/admin/fields";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

/**
 * Chon Tinh / Huyen / Xa (thay public/vendor/backend/library/location.js va phan location trong order.js).
 * Goi GET ajax/location/getLocation?target=districts|wards&data[location_id]=... (tra { html: "<option>..." }).
 * Gia tri chua chon la "0" giong option mac dinh cua Blade.
 */

export type LocationValue = { province_id: string; district_id: string; ward_id: string };

const PROVINCE_ROOT = "[Chọn Thành Phố]";
const DISTRICT_ROOT = "[Chọn Quận/Huyện]";
const WARD_ROOT = "[Chọn Phường/Xã]";

/** Doc <option value="x">ten</option> tu html ajax tra ve (bo option "0"). */
function parseOptions(html: string): ComboOption[] {
  const out: ComboOption[] = [];
  const re = /<option value="([^"]*)">([^<]*)<\/option>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (m[1] !== "0") out.push({ value: m[1], label: m[2] });
  return out;
}

async function fetchLocation(target: "districts" | "wards", id: string): Promise<ComboOption[]> {
  if (!id || id === "0") return [];
  const qs = new URLSearchParams({ target, "data[location_id]": id });
  const res = await fetch(`/ajax/location/getLocation?${qs}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { html?: string };
  return parseOptions(json.html ?? "");
}

export function useLocation(initial: Partial<LocationValue>) {
  const [value, setValue] = useState<LocationValue>({
    province_id: initial.province_id || "0",
    district_id: initial.district_id || "0",
    ward_id: initial.ward_id || "0",
  });
  const [districts, setDistricts] = useState<ComboOption[]>([]);
  const [wards, setWards] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);
  const booted = useRef(false);

  // Lan dau: nap huyen/xa theo gia tri da luu (thay HT.loadCity)
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const { province_id, district_id } = value;
    if (province_id === "0") return;
    setLoading(true);
    Promise.all([fetchLocation("districts", province_id), fetchLocation("wards", district_id)])
      .then(([d, w]) => {
        setDistricts(d);
        setWards(w);
      })
      .finally(() => setLoading(false));
  }, [value]);

  const setProvince = useCallback(async (id: string) => {
    setValue({ province_id: id || "0", district_id: "0", ward_id: "0" });
    setWards([]);
    setLoading(true);
    try {
      setDistricts(await fetchLocation("districts", id));
    } finally {
      setLoading(false);
    }
  }, []);

  const setDistrict = useCallback(async (id: string) => {
    setValue((v) => ({ ...v, district_id: id || "0", ward_id: "0" }));
    setLoading(true);
    try {
      setWards(await fetchLocation("wards", id));
    } finally {
      setLoading(false);
    }
  }, []);

  const setWard = useCallback((id: string) => setValue((v) => ({ ...v, ward_id: id || "0" })), []);

  return { value, districts, wards, loading, setProvince, setDistrict, setWard };
}

/** 3 o chon Tinh/Huyen/Xa. `names` = null thi khong sinh input hidden (dung cho ajax). */
export function LocationFields({
  provinces,
  state,
  names = { province: "province_id", district: "district_id", ward: "ward_id" },
  className,
}: {
  provinces: { code: string; name: string }[];
  state: ReturnType<typeof useLocation>;
  names?: { province: string; district: string; ward: string } | null;
  className?: string;
}) {
  const provinceOptions = [{ value: "0", label: PROVINCE_ROOT }, ...provinces.map((p) => ({ value: p.code, label: p.name }))];
  const districtOptions = [{ value: "0", label: DISTRICT_ROOT }, ...state.districts];
  const wardOptions = [{ value: "0", label: WARD_ROOT }, ...state.wards];
  return (
    <div className={cn("grid gap-4", className)}>
      <Field label="Thành phố">
        <Combobox name={names?.province} options={provinceOptions} value={state.value.province_id} onChange={state.setProvince} searchPlaceholder="Tìm thành phố..." />
      </Field>
      <Field label="Quận/Huyện">
        <Combobox
          name={names?.district}
          options={districtOptions}
          value={state.value.district_id}
          onChange={state.setDistrict}
          disabled={state.loading && state.districts.length === 0}
          searchPlaceholder="Tìm quận/huyện..."
        />
      </Field>
      <Field label="Phường/Xã">
        <Combobox name={names?.ward} options={wardOptions} value={state.value.ward_id} onChange={state.setWard} searchPlaceholder="Tìm phường/xã..." />
      </Field>
    </div>
  );
}

/** Ban dung trong form POST (customer store): tu quan ly state. */
export function LocationSelect({ provinces, defaultValue, className }: { provinces: { code: string; name: string }[]; defaultValue: Partial<LocationValue>; className?: string }) {
  const state = useLocation(defaultValue);
  return <LocationFields provinces={provinces} state={state} className={className} />;
}
