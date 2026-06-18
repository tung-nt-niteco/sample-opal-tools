/** Escape user/AI-provided strings before interpolating into HTML. */
export const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
/**
 * Image placeholder. The AI never invents real image URLs — it provides an
 * `alt` description and we emit a deterministic placeholder src keyed on the
 * requested dimensions and a slug of the alt text. A downstream step (or a
 * human) swaps these for real assets.
 */
export const placeholderImg = (alt, width, height, extraClass = "") => {
    const slug = encodeURIComponent((alt || "image").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40));
    const src = `{{IMAGE:${width}x${height}:${slug}}}`;
    const cls = extraClass ? ` class="${esc(extraClass)}"` : "";
    return `<img src="${src}" alt="${esc(alt)}" width="${width}" height="${height}" loading="lazy"${cls}>`;
};
/** Reverse of `esc` — decode exactly the five entities `esc` produces. */
export const unesc = (s) => s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
/**
 * Scan rendered HTML for placeholder `<img>` tags and return one ImageSlot per
 * tag, in document order. The placeholder token is authoritative for the
 * dimensions; `alt` is read back from the tag and un-escaped.
 */
export const extractImageSlots = (html) => {
    const slots = [];
    const tags = html.match(/<img\b[^>]*>/gi) ?? [];
    for (const tag of tags) {
        const src = /\bsrc="([^"]*)"/i.exec(tag)?.[1] ?? "";
        const m = /^\{\{IMAGE:(\d+)x(\d+):[^}]+\}\}$/.exec(src);
        if (!m)
            continue;
        slots.push({
            placeholder: src,
            alt: unesc(/\balt="([^"]*)"/i.exec(tag)?.[1] ?? ""),
            width: Number(m[1]),
            height: Number(m[2]),
            url: null,
        });
    }
    return slots;
};
/**
 * Deterministically swap each resolved placeholder for its url using a LITERAL
 * string replace (the url is never interpreted as a regex). Slots whose url is
 * still null are left in place and reported. This is the ONLY sanctioned way to
 * put real images into a page — the agent must never hand-edit the html.
 */
export const applyImages = (html, images) => {
    const warnings = [];
    const replaced = new Set();
    let out = html;
    for (const slot of images) {
        if (slot.url == null || slot.url === "") {
            warnings.push(`Image placeholder "${slot.placeholder}" left unresolved (no url) — kept in place.${slot.alt ? ` Alt: "${slot.alt}".` : ""}`);
            continue;
        }
        if (out.includes(slot.placeholder)) {
            out = out.split(slot.placeholder).join(slot.url); // literal, global, no regex
            replaced.add(slot.placeholder);
        }
        else if (!replaced.has(slot.placeholder)) {
            warnings.push(`Image placeholder "${slot.placeholder}" not found in html.`);
        }
    }
    return { html: out, warnings };
};
