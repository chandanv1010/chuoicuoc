"use client";

/** O "Sắp xếp" tu gui form khi doi (thay onchange="this.form.submit()" cua ban cu). */
export function SortSelect({ action, value, options, hidden }: { action: string; value: string; options: [string, string][]; hidden: [string, string][] }) {
  return (
    <form action={action} method="get" className="flex items-center">
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="sort-by" className="sr-only">
        Sắp xếp
      </label>
      <select
        id="sort-by"
        name="sort"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.submit()}
        className="rounded-lg border border-az-border bg-[#f0f2f2] px-2 py-1 text-xs shadow-[0_2px_5px_rgba(15,17,17,0.15)] hover:bg-[#e3e6e6]"
      >
        {options.map(([k, label]) => (
          <option key={k} value={k}>
            Sắp xếp: {label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="az-btn az-btn-secondary ml-2 text-xs">
          Go
        </button>
      </noscript>
    </form>
  );
}
