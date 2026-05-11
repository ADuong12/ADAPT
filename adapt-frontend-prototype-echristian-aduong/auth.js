// Hides the Admin nav link when the current teacher's role isn't admin,
// shows the logged-in teacher's name in the sidebar footer, and provides logout.

(function () {
  if (!localStorage.getItem("currentTeacherId")) {
    if (!location.pathname.endsWith("login.html")) {
      location.href = "login.html";
      return;
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    const role = localStorage.getItem("currentTeacherRole") || "teacher";
    if (role !== "admin") {
      document.querySelectorAll('a[href^="admin-"]').forEach((a) => (a.style.display = "none"));
    }
    const sidebar = document.querySelector(".sidebar");
    if (sidebar && !sidebar.querySelector(".sidebar-footer")) {
      const name = localStorage.getItem("currentTeacherName") || "Teacher";
      const footer = document.createElement("div");
      footer.className = "sidebar-footer";
      footer.style.cssText = "margin-top:auto;padding:12px;border-top:1px solid var(--border);font-size:12px;color:var(--text2);";
      footer.innerHTML = `
        <div style="margin-bottom:6px;">${name}</div>
        <a href="settings.html" style="color:var(--text2);font-size:11px;text-decoration:none;display:block;margin-bottom:4px;">⚙ Settings</a>
        <a href="#" id="logout-btn" style="color:var(--text2);font-size:11px;text-decoration:none;">Log out</a>
      `;
      sidebar.appendChild(footer);
      footer.querySelector("#logout-btn").addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        location.href = "login.html";
      });
    }
  });
})();
