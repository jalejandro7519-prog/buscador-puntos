import { describe, expect, it } from "vitest";
import { detectarPlataforma, etiquetaComoLlegar, urlComoLlegar } from "./directions";

const destino = { lat: 12.1364, lng: -86.251, nombre: "Café Ñandú «Centro»", direccion: "Calle Mayor 1" };

const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("detectarPlataforma", () => {
  it("reconoce iPhone y iPad por user agent", () => {
    expect(detectarPlataforma({ userAgent: UA_IPHONE })).toBe("ios");
    expect(detectarPlataforma({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)" })).toBe("ios");
  });

  it("reconoce iPadOS que se presenta como Mac táctil", () => {
    expect(detectarPlataforma({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
    expect(detectarPlataforma({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })).toBe("otras");
  });

  it("Android y escritorio caen en «otras»", () => {
    expect(detectarPlataforma({ userAgent: UA_ANDROID })).toBe("otras");
    expect(detectarPlataforma(undefined)).toBe("otras");
  });
});

describe("urlComoLlegar", () => {
  it("Android y por defecto: Google Maps con las coordenadas exactas", () => {
    const esperada = "https://www.google.com/maps/dir/?api=1&destination=12.1364,-86.251";
    expect(urlComoLlegar(destino, detectarPlataforma({ userAgent: UA_ANDROID }))).toBe(esperada);
    expect(urlComoLlegar(destino, "otras")).toBe(esperada);
  });

  it("iOS: Apple Maps con coordenadas, modo conducir y nombre codificado", () => {
    expect(urlComoLlegar(destino, detectarPlataforma({ userAgent: UA_IPHONE }))).toBe(
      `https://maps.apple.com/?daddr=12.1364,-86.251&dirflg=d&q=${encodeURIComponent("Café Ñandú «Centro»")}`,
    );
    expect(urlComoLlegar(destino, "ios")).toContain("q=Caf%C3%A9%20%C3%91and%C3%BA");
  });

  it("nunca mete la dirección en la URL: prioriza las coordenadas", () => {
    expect(urlComoLlegar(destino, "otras")).not.toContain("Calle");
    expect(urlComoLlegar(destino, "ios")).not.toContain("Calle");
  });
});

describe("etiquetaComoLlegar", () => {
  it("usa la dirección como texto visible de respaldo", () => {
    expect(etiquetaComoLlegar(destino)).toBe("Cómo llegar a Café Ñandú «Centro», Calle Mayor 1");
  });
});
