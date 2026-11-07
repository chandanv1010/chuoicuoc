"use client";

/** O chon ma moi lua chon la mot lien ket (bo loc kieu dropdown): chon -> chuyen trang. */
export function NavSelect({ label, value, options }: { label: string; value: string; options: { label: string; href: string }[] }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        window.location.href = e.target.value;
      }}
      className="h-10 w-full rounded-lg border border-az-border bg-white px-3 text-sm text-az-text"
    >
      {options.map((o) => (
        <option key={o.href} value={o.href}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
