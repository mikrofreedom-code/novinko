// Porovnanie tajomstiev odolné voči meraniu času (heslo formulára, secret_token Telegramu).
const crypto = require("crypto");

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { safeEqual };
