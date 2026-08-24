export interface ConfiguracionSitio {
  nombre_marca: string;
  descripcion_corta: string;
  whatsapp: string;
  correo: string;
  instagram?: string;
  tiktok?: string;
  pais: string;
  region: string;
  moneda: string;
  simbolo_moneda: string;
  color_principal?: string;
  color_secundario?: string;
  color_principal_intenso?: string;
  color_secundario_intenso?: string;
  color_fondo?: string;
  color_texto?: string;
  color_texto_suave?: string;
  fuente_principal?: 'moderna' | 'redondeada' | 'clasica';
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  tipo_producto?: TipoProducto;
  publicada: boolean;
  orden: number;
}

export interface Tema {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  publicado: boolean;
  orden: number;
}

export interface ImagenProducto {
  id: string;
  url_publica: string;
  texto_alternativo: string;
  es_principal: boolean;
  orden: number;
}

export interface VarianteProducto {
  id: string;
  nombre: string;
  sku?: string;
  precio?: number | null;
  stock?: number | null;
}

export type TipoProducto = 'sticker' | 'plantilla' | 'fisico';
export type EstadoProducto = 'borrador' | 'publicado' | 'oculto' | 'archivado';

export interface Producto {
  id: string;
  categoria_id?: string | null;
  categoria?: Categoria | null;
  tipo_producto: TipoProducto;
  nombre: string;
  slug: string;
  sku?: string;
  descripcion_corta: string;
  descripcion: string;
  precio: number | null;
  moneda: string;
  controla_stock: boolean;
  stock: number | null;
  estado: EstadoProducto;
  destacado: boolean;
  orden: number;
  meta_titulo?: string;
  meta_descripcion?: string;
  temas: Tema[];
  imagenes: ImagenProducto[];
  variantes?: VarianteProducto[];
}

export interface SeccionSitio {
  id?: string;
  clave: string;
  titulo: string;
  subtitulo?: string;
  contenido?: string;
  imagen_url?: string;
  texto_boton?: string;
  enlace_boton?: string;
  publicada: boolean;
  orden: number;
  estilos?: Record<string, EstilosTexto>;
}

export interface EstilosTexto {
  color?: string;
  fuente?: 'moderna' | 'redondeada' | 'clasica';
  tamano?: 'pequeno' | 'normal' | 'mediano' | 'grande' | 'extra_grande';
  negrita?: boolean;
  cursiva?: boolean;
}
