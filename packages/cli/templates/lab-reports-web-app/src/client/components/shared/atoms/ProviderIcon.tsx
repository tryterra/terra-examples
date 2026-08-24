export function ProviderIcon({ icon, name }: { icon?: string; name?: string }) {
  return icon ? (
    <img
      src={icon}
      alt={name ?? ""}
      className="h-10 w-10 rounded-lg border border-black/12 object-contain"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/12 bg-black/4 text-sm font-semibold text-main-black">
      {name?.[0] ?? "?"}
    </div>
  );
}
