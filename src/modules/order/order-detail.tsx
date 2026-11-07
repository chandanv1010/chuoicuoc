"use client";

import { BanIcon, CheckCircle2Icon, CircleAlertIcon, Loader2Icon, PencilIcon, TruckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/misc";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { LocationFields, useLocation } from "@/modules/customer/location-select";
import { OrderBadgeSelect } from "./order-list";

/**
 * Phan client cua order/{id}/detail — thay public/vendor/backend/library/order.js:
 * sua ghi chu, sua thong tin khach (+ tinh/huyen/xa), xac nhan / huy don, doi thanh toan / giao hang.
 * Tat ca goi POST ajax/order/update {id, payload[field]=value} -> {error: 10|11, messages, order}.
 */

type UpdateResult = { error?: number; messages?: string; order?: Record<string, unknown> };

async function updateOrder(id: string, payload: Record<string, string>): Promise<UpdateResult> {
  const body = new URLSearchParams({ id });
  for (const [k, v] of Object.entries(payload)) body.append(`payload[${k}]`, v);
  const res = await fetch("/ajax/order/update", { method: "POST", body, headers: { "x-requested-with": "XMLHttpRequest" } });
  const json = (await res.json().catch(() => null)) as UpdateResult | null;
  if (!json) throw new Error(`Lỗi ${res.status}`);
  return json;
}

function EditToggle({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      {editing ? (
        <>
          <XIcon /> Hủy bỏ
        </>
      ) : (
        <>
          <PencilIcon /> Sửa
        </>
      )}
    </Button>
  );
}

/* ----------------------------- Ghi chu ----------------------------- */

export function OrderNote({ id, defaultValue }: { id: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState(defaultValue);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateOrder(id, { description: draft });
      if (res.error === 10) {
        setValue(draft);
        setEditing(false);
        toast.success("Đã cập nhật ghi chú");
      } else toast.error(res.messages || "Cập nhật ghi chú không thành công");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ghi chú</CardTitle>
        <EditToggle
          editing={editing}
          onClick={() => {
            setDraft(value);
            setEditing(!editing);
          }}
        />
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid gap-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="min-h-24" aria-label="Ghi chú đơn hàng" />
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2Icon className="animate-spin" />} Lưu ghi chú
              </Button>
            </div>
          </div>
        ) : value ? (
          <p className="text-sm whitespace-pre-line">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có ghi chú.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Thong tin khach hang ----------------------------- */

export type CustomerInfo = {
  fullname: string;
  email: string;
  phone: string;
  address: string;
  province_id: string;
  district_id: string;
  ward_id: string;
  province_name: string;
  district_name: string;
  ward_name: string;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function OrderCustomer({ id, info: initial, provinces }: { id: string; info: CustomerInfo; provinces: { code: string; name: string }[] }) {
  const [info, setInfo] = useState(initial);
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin khách hàng</CardTitle>
        <EditToggle editing={editing} onClick={() => setEditing(!editing)} />
      </CardHeader>
      <CardContent>
        {editing ? (
          <CustomerForm
            key={`${info.province_id}-${info.district_id}-${info.ward_id}`}
            id={id}
            info={info}
            provinces={provinces}
            onSaved={(next) => {
              setInfo(next);
              setEditing(false);
            }}
          />
        ) : (
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Họ tên</dt>
            <dd className="font-medium">{info.fullname}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{info.email}</dd>
            <dt className="text-muted-foreground">Điện thoại</dt>
            <dd>{info.phone}</dd>
            <dt className="text-muted-foreground">Địa chỉ</dt>
            <dd>{info.address}</dd>
            <dt className="text-muted-foreground">Phường/Xã</dt>
            <dd>{info.ward_name}</dd>
            <dt className="text-muted-foreground">Quận/Huyện</dt>
            <dd>{info.district_name}</dd>
            <dt className="text-muted-foreground">Tỉnh/TP</dt>
            <dd>{info.province_name}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerForm({ id, info, provinces, onSaved }: { id: string; info: CustomerInfo; provinces: { code: string; name: string }[]; onSaved: (info: CustomerInfo) => void }) {
  const [form, setForm] = useState({ fullname: info.fullname, email: info.email, phone: info.phone, address: info.address });
  const location = useLocation({ province_id: info.province_id, district_id: info.district_id, ward_id: info.ward_id });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // HT.saveCustomer
  const save = async () => {
    setSaving(true);
    try {
      const res = await updateOrder(id, { ...form, ...location.value });
      if (res.error === 10 && res.order) {
        const o = res.order;
        onSaved({
          fullname: str(o.fullname),
          email: str(o.email),
          phone: str(o.phone),
          address: str(o.address),
          province_id: str(o.province_id),
          district_id: str(o.district_id),
          ward_id: str(o.ward_id),
          province_name: str(o.province_name),
          district_name: str(o.district_name),
          ward_name: str(o.ward_name),
        });
        toast.success("Đã cập nhật thông tin khách hàng");
      } else toast.error(res.messages || "Cập nhật không thành công");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <Field label="Họ tên">
        <Input value={form.fullname} onChange={set("fullname")} />
      </Field>
      <Field label="Email">
        <Input value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Số điện thoại">
        <Input value={form.phone} onChange={set("phone")} />
      </Field>
      <Field label="Địa chỉ">
        <Input value={form.address} onChange={set("address")} />
      </Field>
      <LocationFields provinces={provinces} state={location} names={null} className="gap-3" />
      <Button type="button" onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="animate-spin" />} Lưu lại
      </Button>
    </div>
  );
}

/* ----------------------------- Xac nhan / thanh toan / giao hang ----------------------------- */

export function OrderStatusPanel({
  id,
  confirm: initialConfirm,
  payment: initialPayment,
  delivery,
  amount,
  methodTitle,
  confirmLang,
  cartLang,
}: {
  id: string;
  confirm: string;
  payment: string;
  delivery: string;
  amount: string;
  methodTitle: string;
  confirmLang: Record<string, string>;
  cartLang: Record<string, Record<string, string>>;
}) {
  const [confirm, setConfirm] = useState(initialConfirm);
  const [payment, setPayment] = useState(initialPayment);
  const [busy, setBusy] = useState<string | null>(null);
  const opts = (key: string) => Object.entries(cartLang[key] ?? {}).filter(([k]) => k !== "none");

  // HT.updateField + HT.createOrderConfirmSection
  const setStatus = async (value: "confirm" | "cancle") => {
    setBusy(value);
    try {
      const res = await updateOrder(id, { confirm: value });
      if (res.error === 10) {
        setConfirm(value);
        toast.success(value === "confirm" ? "Đã xác nhận đơn hàng" : "Đã hủy đơn hàng");
      } else toast.error(res.messages || "Cập nhật không thành công");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pending = confirm === "pending";
  const cancelled = confirm === "cancle";

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4",
          pending && "border-warning/40 bg-warning/10",
          confirm === "confirm" && "border-success/30 bg-success/5",
          cancelled && "border-destructive/30 bg-destructive/5",
        )}
      >
        <div className="flex items-center gap-3">
          {pending ? (
            <CircleAlertIcon className="size-8 text-amber-600" />
          ) : cancelled ? (
            <BanIcon className="size-8 text-destructive" />
          ) : (
            <CheckCircle2Icon className="size-8 text-success" />
          )}
          <div>
            <div className="text-sm font-semibold">
              {confirmLang[confirm] ?? confirm} <span className="text-primary">{amount}</span>
            </div>
            <div className="text-xs text-muted-foreground">{methodTitle}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending && (
            <Button type="button" onClick={() => setStatus("confirm")} disabled={busy !== null}>
              {busy === "confirm" ? <Loader2Icon className="animate-spin" /> : <TruckIcon />} Xác nhận đơn
            </Button>
          )}
          {confirm === "confirm" && payment !== "paid" && (
            <Button type="button" variant="outline" className="text-destructive" onClick={() => setStatus("cancle")} disabled={busy !== null}>
              {busy === "cancle" ? <Loader2Icon className="animate-spin" /> : <BanIcon />} Hủy đơn
            </Button>
          )}
          {confirm === "confirm" && payment === "paid" && <Badge variant="success">Đơn hàng đã thanh toán</Badge>}
          {cancelled && <Badge variant="destructive">Đơn hàng đã hủy</Badge>}
        </div>
      </div>
      {!cancelled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Thanh toán</Label>
            <OrderBadgeSelect id={id} field="payment" value={initialPayment} confirm={confirm} options={opts("payment")} onChanged={setPayment} />
          </div>
          <div className="grid gap-1.5">
            <Label>Giao hàng</Label>
            <OrderBadgeSelect id={id} field="delivery" value={delivery} confirm={confirm} options={opts("delivery")} />
          </div>
          {pending && <p className="text-xs text-muted-foreground sm:col-span-2">Cần xác nhận đơn hàng trước khi cập nhật thanh toán / giao hàng.</p>}
        </div>
      )}
    </div>
  );
}
