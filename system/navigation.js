// A small visitor menu, independent of the complete route index.
export const NAV_PRIMARY_ROUTES = [
  { label: "Flywheel", href: "flywheel.html", family: "Systems" },
  { label: "Bulletin", href: "bulletin.html", family: "Bulletin" },
  { label: "Writing", href: "publications.html", family: "Research" },
  { label: "Fonts", href: "fonts.html", family: "Fonts" },
  { label: "Studio", href: "studio.html", family: "Studio" },
  { label: "Hire me", href: "hire.html", family: "Work" },
];

export const NAV_MENU_GROUPS = [
  { label: "Explore", routes: [
    { label: "All projects", href: "catalog.html", family: "Systems" },
    { label: "Research", href: "research.html", family: "Research" },
    { label: "Frontier Safety", href: "frontier-safety.html", family: "Research" },
    { label: "Gallery", href: "gallery.html", family: "Studio" },
  ] },
  { label: "About & contact", routes: [
    { label: "About Zain", href: "person.html", family: "Work" },
    { label: "Resume", href: "resume.html", family: "Work" },
    { label: "Full site index", href: "index.html#site-index", family: "" },
  ] },
];
