/* FAQ accordion — fecha os outros ao abrir um */
const items = document.querySelectorAll(".faq__item");
items.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (item.open) items.forEach((o) => { if (o !== item) o.open = false; });
  });
});
