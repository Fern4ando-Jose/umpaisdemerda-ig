// Invariante do parser do DuckDuckGo: extrai título + snippet + URL real do HTML
// do DDG, casando título e snippet por ordem, decodificando o redirect (uddg=) e
// limpando tags/entidades. Resultado sem snippet é descartado. Tudo fail-open:
// HTML vazio/lixo → []. Se o DDG mudar o HTML, este teste quebra ANTES da prod.
import { describe, it, expect } from "vitest";
import { parseDuckDuckGoHtml } from "./ddg";

const SAMPLE = `
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fes.wikipedia.org%2Fwiki%2FDopamina&amp;rut=abc123">Dopamina - Wikipedia</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fes.wikipedia.org%2Fwiki%2FDopamina">La <b>dopamina</b> es un neurotransmisor relacionado con la recompensa &amp; la motivaci&oacute;n.</a>
</div>
<div class="result results_links results_links_deep web-result">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.verywellmind.com%2Fdopamine-2795375&amp;rut=xyz">Dopamine: What It Is</a>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.verywellmind.com%2Fdopamine-2795375">Dopamine is a neurotransmitter that plays a role in pleasure.</a>
</div>
`;

describe("parseDuckDuckGoHtml", () => {
  it("extrai título, snippet e URL real (uddg decodificado) por resultado", () => {
    const r = parseDuckDuckGoHtml(SAMPLE);
    expect(r).toHaveLength(2);

    expect(r[0].title).toBe("Dopamina - Wikipedia");
    // tags <b> removidas, &amp; decodificado, espaços normalizados
    expect(r[0].content).toContain("dopamina es un neurotransmisor");
    expect(r[0].content).toContain("recompensa & la");
    expect(r[0].content).not.toContain("<b>");
    expect(r[0].url).toBe("https://es.wikipedia.org/wiki/Dopamina");

    expect(r[1].title).toBe("Dopamine: What It Is");
    expect(r[1].url).toBe("https://www.verywellmind.com/dopamine-2795375");
  });

  it("é fail-open: HTML vazio/sem resultados → []", () => {
    expect(parseDuckDuckGoHtml("")).toEqual([]);
    expect(parseDuckDuckGoHtml("<html><body>nada aqui</body></html>")).toEqual([]);
  });

  it("descarta resultado sem snippet (snippet é o contexto que importa)", () => {
    const onlyTitle = `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.com">Só título</a>`;
    expect(parseDuckDuckGoHtml(onlyTitle)).toEqual([]);
  });
});
