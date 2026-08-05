import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WordImage } from "@/components/WordImage";

describe("WordImage", () => {
  it("renders nothing when src is undefined", () => {
    const html = renderToStaticMarkup(
      <WordImage alt="nasi" />,
    );
    expect(html).toBe("");
  });

  it("renders an image with the given src and alt", () => {
    const html = renderToStaticMarkup(
      <WordImage src="/images/food/nasi.jpg" alt="rice" />,
    );
    expect(html).toMatch(/url=%2Fimages%2Ffood%2Fnasi\.jpg/);
    expect(html).toContain('alt="rice"');
  });

  it("lazy-loads and async-decodes the image", () => {
    const html = renderToStaticMarkup(
      <WordImage src="/images/food/nasi.jpg" alt="rice" />,
    );
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it("uses a video aspect wrapper for lesson cards", () => {
    const html = renderToStaticMarkup(
      <WordImage src="/images/food/nasi.jpg" alt="rice" aspect="video" />,
    );
    expect(html).toContain("aspect-video");
  });

  it("uses a square aspect wrapper for thumbnails", () => {
    const html = renderToStaticMarkup(
      <WordImage src="/images/food/nasi.jpg" alt="rice" aspect="square" />,
    );
    expect(html).toContain("aspect-square");
  });

  it("defaults to square aspect", () => {
    const html = renderToStaticMarkup(
      <WordImage src="/images/food/nasi.jpg" alt="rice" />,
    );
    expect(html).toContain("aspect-square");
  });

  it("appends a custom className to the wrapper", () => {
    const html = renderToStaticMarkup(
      <WordImage src="/images/food/nasi.jpg" alt="rice" className="mt-4" />,
    );
    expect(html).toContain("mt-4");
  });
});
