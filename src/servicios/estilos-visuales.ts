import type { ConfiguracionSitio, EstilosTexto, SeccionSitio } from '../tipos/contenidos';

const COLORES_PREDETERMINADOS = {
  color_principal: '#98b7ff',
  color_secundario: '#df98ff',
  color_principal_intenso: '#526ca8',
  color_secundario_intenso: '#9358ad',
  color_fondo: '#fbfaff',
  color_texto: '#252434',
  color_texto_suave: '#676579',
} as const;

const VARIABLES_CSS_COLORES = {
  color_principal: '--azul-sol',
  color_secundario: '--lila-sol',
  color_principal_intenso: '--azul-profundo',
  color_secundario_intenso: '--lila-profundo',
  color_fondo: '--fondo',
  color_texto: '--tinta',
  color_texto_suave: '--tinta-suave',
} as const;

const FUENTES = {
  moderna: 'Inter, ui-rounded, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  redondeada: 'ui-rounded, "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif',
  clasica: 'Georgia, "Times New Roman", serif',
} as const;

const TAMANOS = {
  pequeno: '0.9em',
  normal: '1em',
  mediano: '1.12em',
  grande: '1.28em',
  extra_grande: '1.5em',
} as const;

export const OPCIONES_FUENTE = [
  { valor: 'moderna', texto: 'Moderna' },
  { valor: 'redondeada', texto: 'Redondeada' },
  { valor: 'clasica', texto: 'Clásica' },
] as const;

export const OPCIONES_TAMANO = [
  { valor: 'pequeno', texto: 'Pequeño' },
  { valor: 'normal', texto: 'Normal' },
  { valor: 'mediano', texto: 'Mediano' },
  { valor: 'grande', texto: 'Grande' },
  { valor: 'extra_grande', texto: 'Extra grande' },
] as const;

export const CAMPOS_ESTILO_SECCION = [
  { clave: 'titulo', etiqueta: 'Título' },
  { clave: 'subtitulo', etiqueta: 'Subtítulo' },
  { clave: 'contenido', etiqueta: 'Contenido' },
  { clave: 'texto_boton', etiqueta: 'Texto del botón' },
] as const;

export function esColorHexadecimal(valor: unknown): valor is string {
  return typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor);
}

function colorSeguro(valor: unknown, predeterminado: string) {
  return esColorHexadecimal(valor) ? valor : predeterminado;
}

function fuenteSegura(valor: unknown) {
  return typeof valor === 'string' && valor in FUENTES ? valor as keyof typeof FUENTES : 'moderna';
}

function tamanoSeguro(valor: unknown) {
  return typeof valor === 'string' && valor in TAMANOS ? valor as keyof typeof TAMANOS : 'normal';
}

export function obtenerEstiloGlobal(configuracion?: Partial<ConfiguracionSitio>) {
  const colores = Object.entries(COLORES_PREDETERMINADOS).map(([clave, predeterminado]) => {
    const color = colorSeguro(configuracion?.[clave as keyof ConfiguracionSitio], predeterminado);
    const variableOriginal = `--${clave.replaceAll('_', '-')}`;
    const variableSitio = VARIABLES_CSS_COLORES[clave as keyof typeof VARIABLES_CSS_COLORES];
    return `${variableOriginal}:${color};${variableSitio}:${color}`;
  });
  const fuente = FUENTES[fuenteSegura(configuracion?.fuente_principal)];

  return [...colores, `--fuente-principal:${fuente}`].join(';');
}

export function obtenerEstiloTexto(seccion: SeccionSitio | undefined, campo: keyof SeccionSitio['estilos']) {
  const estilo = seccion?.estilos?.[campo] as EstilosTexto | undefined;
  if (!estilo) return undefined;

  const reglas = [
    `color:${colorSeguro(estilo.color, 'inherit')}`,
    `font-family:${FUENTES[fuenteSegura(estilo.fuente)]}`,
    `font-size:${TAMANOS[tamanoSeguro(estilo.tamano)]}`,
  ];

  if (estilo.negrita) reglas.push('font-weight:800');
  if (estilo.cursiva) reglas.push('font-style:italic');
  return reglas.join(';');
}

export { COLORES_PREDETERMINADOS };
