/** Redirect to the appropriate login page after auth failure. */
export function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (
    path === "/login" ||
    path === "/admin/login" ||
    path === "/register" ||
    path === "/admin/register"
  ) {
    return;
  }
  window.location.href = path.startsWith("/admin") ? "/admin/login" : "/login";
}
