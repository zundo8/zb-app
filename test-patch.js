fetch("http://localhost:3001/api/admin/settings", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ whatsappPhoneId: "12345" })
}).then(r => r.json()).then(console.log).catch(console.error);
