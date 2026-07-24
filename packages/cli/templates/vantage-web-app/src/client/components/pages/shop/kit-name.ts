/** The order item carries no product/variant name — only product_type_id — so
 *  the patient-facing kit title falls back to the product-type name. */
export function kitDisplayName(
  productTypeId: string | undefined,
  types: Array<{ id: number; name: string }> | undefined,
): string {
  const t = types?.find((x) => String(x.id) === productTypeId);
  return t?.name ?? "Test kit";
}
