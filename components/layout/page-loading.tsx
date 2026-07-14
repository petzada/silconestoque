interface PageLoadingProps {
  label: string;
}

export function PageLoading({ label }: PageLoadingProps) {
  return <div className="py-20 text-center font-medium text-muted-foreground">{label}</div>;
}
