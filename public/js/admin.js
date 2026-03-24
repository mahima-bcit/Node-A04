async function jsonFetch(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

document.addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-toggle-read]");
  if (toggleBtn) {
    const id = toggleBtn.dataset.toggleRead;
    const { res, data } = await jsonFetch(`/admin/contacts/${id}/read`, {
      method: "PATCH",
    });
    if (!res.ok) return alert(data.error || "Failed to toggle.");
    location.reload();
  }

  const deleteBtn = e.target.closest("[data-delete]");
  if (deleteBtn) {
    const url = deleteBtn.dataset.delete;
    if (!confirm("Do you want to delete this?")) return;

    const { res, data } = await jsonFetch(url, { method: "DELETE" });
    if (!res.ok) return alert(data.message || data.error || "Delete failed.");
    location.reload();
  }
});