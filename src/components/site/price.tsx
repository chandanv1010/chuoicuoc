import { formatPrice, priceParts } from "@/modules/frontend/money";

/** Gia kieu Amazon: ky hieu + phan nguyen lon + phan xu nho phia tren ($24.99 -> $ 24 ^99). */
export function Price({
  value,
  size = "md",
  deal = false,
  className = "",
}: {
  /** number, chuoi "24.99" hoac Prisma.Decimal */
  value: number | string | { toFixed(dp?: number): string } | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  deal?: boolean;
  className?: string;
}) {
  const { symbol, whole, fraction } = priceParts(value);
  const big = { sm: "text-lg", md: "text-[28px]", lg: "text-[28px]", xl: "text-[32px]" }[size];
  const small = { sm: "text-[10px]", md: "text-[13px]", lg: "text-[13px]", xl: "text-[14px]" }[size];
  return (
    <span className={`relative inline-flex items-start leading-none ${deal ? "text-az-deal" : ""} ${className}`}>
      <span className="sr-only">{formatPrice(value)}</span>
      <span aria-hidden="true" className={`${small} mt-[0.2em]`}>
        {symbol}
      </span>
      <span aria-hidden="true" className={`${big} font-normal`}>
        {whole}
      </span>
      {fraction ? (
        <span aria-hidden="true" className={`${small} mt-[0.2em]`}>
          {fraction}
        </span>
      ) : null}
    </span>
  );
}
