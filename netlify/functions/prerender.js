const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    // Fetchni RSS data
    const baseUrl = process.env.URL || "https://novinko.netlify.app";
    const categories = ["all", "slovensko", "svet", "ekonomika", "sport", "krypto"];
    
    const store = getStore("rss-cache");
    
    for (const cat of categories) {
      try {
        const res = await fetch(`${baseUrl}/.netlify/functions/fetch-rss?category=${cat}&nocache=1`);
        const data = await res.json();
        await store.set(cat, JSON.stringify(data));
      } catch(e) {
        console.log(`Error caching ${cat}:`, e.message);
      }
    }
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
