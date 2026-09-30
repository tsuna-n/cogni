const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  brain:
    "M12 5c-3-5-8-1-7 3-4 2-3 7 0 8-1 4 4 7 7 3V5Zm0 0c3-5 8-1 7 3 4 2 3 7 0 8 1 4-4 7-7 3 M5 8l3 2 M5 16l3-2 M19 8l-3 2 M19 16l-3-2",
  flask: "M9 3h6 M10 3v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3 M7 15h10",
  pulse: "M2 12h5l3-8 4 16 3-8h5",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
  calendar:
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 11h18 M7 15h2 M13 15h2",
  file: "M14 2H5v20h14V7l-5-5v5h5 M8 12h8 M8 16h8",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
  game: "M7 7h10a4 4 0 0 1 4 3l1 7q0 4-4 2l-3-3H9l-3 3q-4 2-4-2l1-7a4 4 0 0 1 4-3 M6 10v5 M3.5 12.5h5 M16 11h.1 M19 14h.1",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4 M8 12l3 3 5-6",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  refresh: "M20 7a9 9 0 1 0 1 8 M20 2v6h-6",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  check: "m5 12 4 4L19 6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  logout: "M9 3H3v18h6 M8 12h13 M16 7l5 5-5 5",
  book: "M12 5Q7 1 2 4v16q5-3 10 1 5-4 10-1V4q-5-3-10 1v16",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v6 M12 7h.01",
};

export default function DashboardIcon({ name = "grid", size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
