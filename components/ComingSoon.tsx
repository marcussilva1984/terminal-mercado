export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      <h2 className="text-lg font-medium text-text">{title}</h2>
      <p className="max-w-md text-sm text-text-muted">{note ?? "Em breve."}</p>
    </div>
  );
}
