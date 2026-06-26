type MaterialIconProps = {
  name: string;
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function MaterialIcon({
  name,
  filled = false,
  className = "",
  style,
}: MaterialIconProps) {
  return (
    <span
      className={`${filled ? "material-symbols-filled" : "material-symbols-outlined"} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
