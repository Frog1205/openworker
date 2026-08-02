import { afterEach, describe, expect, it, vi } from "vitest";

describe("product context contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the selected Atlas product from the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            product_id: "atlas-enterprise",
            product_type: "enterprise",
            name: "Atlas Enterprise",
          }),
          { status: 200 },
        ),
      ),
    );
    const { getProduct } = await import("./api");
    const product = await getProduct();
    expect(product.product_id).toBe("atlas-enterprise");
    expect(product.name).toBe("Atlas Enterprise");
  });
});
