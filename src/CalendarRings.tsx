import type { Ring } from "./calendar-rings";
export function CalendarRings({
  food,
  exercise,
}: {
  food: Ring;
  exercise: Ring;
}) {
  const ring = (value: Ring, r: number, name: string) => {
    if (value.state === "none") return null;
    const circumference = 2 * Math.PI * r;
    return (
      <g
        className={"activity-ring " + value.state}
        data-ring={name}
        data-state={value.state}
        data-progress={value.percent ?? "unknown"}
      >
        <circle className="ring-track" cx="26" cy="26" r={r} />
        <circle
          className="ring-fill"
          cx="26"
          cy="26"
          r={r}
          strokeDasharray={value.dashed ? "2 3" : circumference}
          strokeDashoffset={
            value.dashed ? 0 : circumference * (1 - (value.percent ?? 0) / 100)
          }
          transform="rotate(-90 26 26)"
        />
      </g>
    );
  };
  return (
    <svg className="calendar-rings" viewBox="0 0 52 52" aria-hidden="true">
      {ring(food, 23, "food")}
      {ring(exercise, 18.5, "exercise")}
    </svg>
  );
}
