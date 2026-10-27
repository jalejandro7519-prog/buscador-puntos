/** Minúsculas y sin tildes, para comparar y buscar. */
export function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Slug estable: «Punto demo 01» + «11001» → «punto-demo-01-11001». */
export function slug(...partes: string[]): string {
  return normalizar(partes.filter(Boolean).join(" "))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Id determinista a partir de nombre + código postal. */
export function generarId(nombre: string, codigoPostal: string): string {
  return slug(nombre, codigoPostal) || "punto";
}

/** Añade -2, -3… hasta que el id no esté en `usados`. */
export function idUnico(base: string, usados: ReadonlySet<string>): string {
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
