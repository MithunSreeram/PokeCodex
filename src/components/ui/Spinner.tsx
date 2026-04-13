export function Spinner({ size = 8 }: { size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full border-4 border-gray-700 border-t-red-500 animate-spin`}
    />
  );
}
