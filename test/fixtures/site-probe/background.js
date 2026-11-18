browser.webRequest.onBeforeRequest.addListener(
  d => ({ cancel: d.url.includes("vfx-wr-block") }),
  { urls: ["<all_urls>"] },
  ["blocking"],
);
