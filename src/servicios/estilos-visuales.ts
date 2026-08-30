import type { ConfiguracionSitio } from '../tipos/contenidos';

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

export function esColorHexadecimal(valor: unknown): valor is string {
  return typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor);
}

function colorSeguro(valor: unknown, predeterminado: string) {
  return esColorHexadecimal(valor) ? valor : predeterminado;
}

export function obtenerEstiloGlobal(configuracion?: Partial<ConfiguracionSitio>) {
  return Object.entries(COLORES_PREDETERMINADOS).map(([clave, predeterminado]) => {
    const color = colorSeguro(configuracion?.[clave as keyof ConfiguracionSitio], predeterminado);
    const variableOriginal = `--${clave.replaceAll('_', '-')}`;
    const variableSitio = VARIABLES_CSS_COLORES[clave as keyof typeof VARIABLES_CSS_COLORES];
    return `${variableOriginal}:${color};${variableSitio}:${color}`;
  }).join(';');
}

export { COLORES_PREDETERMINADOS };
