import "server-only";

/**
 * Ten model Laravel (data-model="PostCatalogue" trong HTML) -> ten bang.
 * Dung cho cac endpoint ajax chung: changeStatus, changeStatusAll, updateOrder...
 */
export const MODEL_TABLES: Record<string, string> = {
  Attribute: "attributes",
  AttributeCatalogue: "attribute_catalogues",
  Contact: "contacts",
  Customer: "customers",
  CustomerCatalogue: "customer_catalogues",
  Dealer: "dealers",
  DealerRegistration: "dealer_registrations",
  Distribution: "distributions",
  DistributionArea: "distribution_areas",
  HomeFeature: "home_features",
  Introduce: "introduces",
  Language: "languages",
  Lecturer: "lecturers",
  Menu: "menus",
  MenuCatalogue: "menu_catalogues",
  Order: "orders",
  Permission: "permissions",
  Post: "posts",
  PostCatalogue: "post_catalogues",
  Product: "products",
  ProductCatalogue: "product_catalogues",
  ProductVariant: "product_variants",
  Promotion: "promotions",
  Review: "reviews",
  Slide: "slides",
  Source: "sources",
  User: "users",
  UserCatalogue: "user_catalogues",
  Voucher: "vouchers",
  Widget: "widgets",
};

export function tableOf(model: unknown): string | null {
  if (typeof model !== "string") return null;
  const key = model.charAt(0).toUpperCase() + model.slice(1);
  return MODEL_TABLES[key] ?? null;
}

/** Chi cho phep cap nhat cac cot trang thai qua ajax chung. */
export const STATUS_FIELDS = new Set(["publish", "follow", "status", "current", "is_default", "featured"]);
