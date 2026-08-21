// Configuración global
const configuracion = {
    totalStickers: 1000,
    stickersPorPagina: 98,
    rutaCarpetaStickers: './stickers/',
    numeroWhatsApp: '541164879422'
};

// Carrito de compras
let carrito = [];

// Variables globales
let paginaActual = 1;
let stickersActuales = [];
let todosLosStickers = [];

// Elementos del DOM - Navegación
const enlacesNav = document.querySelectorAll('.enlace-nav');
const secciones = document.querySelectorAll('.seccion-pagina');

// Elementos del DOM - Catálogo
const galeriaStickers = document.getElementById('galeria-stickers');
const textoCargando = document.getElementById('texto-cargando');
const botonAnterior = document.getElementById('boton-anterior');
const botonSiguiente = document.getElementById('boton-siguiente');
const informacionPagina = document.getElementById('informacion-pagina');
const campoBusqueda = document.getElementById('buscador');
const botonBuscar = document.getElementById('boton-buscar');
const botonResetear = document.getElementById('boton-resetear');
const inputPagina = document.getElementById('input-pagina');
const botonIrPagina = document.getElementById('boton-ir-pagina');

// Elementos del carrito
const botonCarrito = document.getElementById('boton-carrito');
const panelCarrito = document.getElementById('panel-carrito');
const cerrarCarrito = document.getElementById('cerrar-carrito');
const contadorCarrito = document.getElementById('contador-carrito');
const contenidoCarrito = document.getElementById('contenido-carrito');
const totalItems = document.getElementById('total-items');
const botonEnviarPedido = document.getElementById('boton-enviar-pedido');
const botonVaciarCarrito = document.getElementById('boton-vaciar-carrito');

// ===== NAVEGACIÓN ENTRE SECCIONES =====

// Función para cambiar de sección
function cambiarSeccion(nombreSeccion) {
    // Remover clase activa de todos los enlaces y secciones
    enlacesNav.forEach(enlace => enlace.classList.remove('activo'));
    secciones.forEach(seccion => seccion.classList.remove('activa'));
    
    // Agregar clase activa a la sección y enlace correspondiente
    const seccionActiva = document.getElementById(`seccion-${nombreSeccion}`);
    const enlaceActivo = document.querySelector(`[data-seccion="${nombreSeccion}"]`);
    
    if (seccionActiva) {
        seccionActiva.classList.add('activa');
    }
    
    if (enlaceActivo) {
        enlaceActivo.classList.add('activo');
    }
    
    // Si cambiamos al catálogo y no se ha cargado, cargarlo
    if (nombreSeccion === 'catalogo' && todosLosStickers.length === 0) {
        inicializarCatalogo();
    }
    
    // Si cambiamos a plantillas, aplicar protección
    if (nombreSeccion === 'plantillas') {
        setTimeout(() => {
            aplicarProteccionPlantillas();
        }, 100);
    }
}

// Event listeners para los enlaces de navegación
enlacesNav.forEach(enlace => {
    enlace.addEventListener('click', (e) => {
        e.preventDefault();
        const seccion = enlace.getAttribute('data-seccion');
        cambiarSeccion(seccion);
    });
});

// Event listener para el botón "Ver Catálogo" y otros elementos con data-seccion
document.addEventListener('click', (e) => {
    const elemento = e.target.closest('[data-seccion]');
    if (elemento && !elemento.classList.contains('enlace-nav')) {
        e.preventDefault();
        const seccion = elemento.getAttribute('data-seccion');
        cambiarSeccion(seccion);
    }
});

// Manejar enlaces hash en la URL
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1); // Quitar el #
    if (hash && (hash === 'inicio' || hash === 'catalogo' || hash === 'plantillas' || hash === 'san-valentin' || hash === 'productos-fisicos')) {
        cambiarSeccion(hash);
    }
});

// ===== FUNCIONES DE PLANTILLAS =====

// Función para ampliar una plantilla (similar a ampliar sticker)
function ampliarPlantilla(rutaImagen, titulo) {
    const existe = document.getElementById('modal-sticker');
    if (existe) {
        existe.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'modal-sticker';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: pointer;
    `;
    
    const contenedor = document.createElement('div');
    contenedor.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 15px;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        position: relative;
    `;
    
    // Botón de cerrar
    const botonCerrar = document.createElement('button');
    botonCerrar.innerHTML = '&times;';
    botonCerrar.style.cssText = `
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: #df98ff;
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 2rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        transition: all 0.3s ease;
    `;
    botonCerrar.onmouseover = () => {
        botonCerrar.style.background = '#c97aff';
        botonCerrar.style.transform = 'scale(1.1)';
    };
    botonCerrar.onmouseout = () => {
        botonCerrar.style.background = '#df98ff';
        botonCerrar.style.transform = 'scale(1)';
    };
    botonCerrar.onclick = (e) => {
        e.stopPropagation();
        modal.remove();
    };
    
    contenedor.appendChild(botonCerrar);
    
    const contenedorImagen = document.createElement('div');
    contenedorImagen.style.cssText = `
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const posicionesMarcas = [
        { top: '-15%', left: '80%' },
        { top: '-5%', left: '90%' },
        { top: '5%', left: '100%' }
    ];
    
    posicionesMarcas.forEach((posicion) => {
        const marcaAgua = document.createElement('div');
        marcaAgua.textContent = 'Papelería de Sol • Papelería de Sol • Papelería de Sol';
        marcaAgua.style.cssText = `
            position: absolute;
            top: ${posicion.top};
            left: ${posicion.left};
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 1.5rem;
            font-weight: bold;
            color: rgba(152, 183, 255, 0.2);
            white-space: nowrap;
            pointer-events: none;
            z-index: 2;
            user-select: none;
            width: 200%;
        `;
        contenedorImagen.appendChild(marcaAgua);
    });
    
    const imagen = document.createElement('img');
    imagen.src = rutaImagen;
    imagen.alt = titulo;
    imagen.style.cssText = `
        max-width: 100%;
        max-height: 70vh;
        border-radius: 10px;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
        -webkit-touch-callout: none;
        pointer-events: none;
    `;
    
    contenedorImagen.appendChild(imagen);
    
    const numero = document.createElement('h3');
    numero.textContent = titulo;
    numero.style.cssText = `
        color: #98b7ff;
        font-size: 1.5rem;
        margin: 0;
    `;
    
    contenedor.appendChild(numero);
    contenedor.appendChild(contenedorImagen);
    modal.appendChild(contenedor);
    
    // Protección contra clic derecho en el modal
    modal.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Protección contra arrastrar
    modal.addEventListener('dragstart', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Protección contra selección
    modal.addEventListener('selectstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });
    
    // Solo el botón X puede cerrar el modal
    contenedor.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.body.appendChild(modal);
}

// Función para solicitar plantilla por WhatsApp
function solicitarPlantilla(nombreProducto, precio) {
    let mensaje = `Hola! Me interesa la plantilla:\n\n`;
    mensaje += `${nombreProducto}\n`;
    if (precio > 0) {
        mensaje += `Precio: $${precio.toLocaleString('es-AR')}\n`;
    }
    mensaje += `\nPodrias darme mas informacion?\n\nGracias!`;
    
    const url = `https://wa.me/${configuracion.numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// ===== FUNCIONES DEL CATÁLOGO =====

// Función para generar el array de todos los stickers
function generarListaStickers() {
    todosLosStickers = [];
    for (let i = 1; i <= configuracion.totalStickers; i++) {
        todosLosStickers.push({
            numero: i,
            ruta: `${configuracion.rutaCarpetaStickers}${i}.png`
        });
    }
    stickersActuales = [...todosLosStickers];
}

// Función para crear una tarjeta de sticker
function crearTarjetaSticker(sticker) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta-sticker';
    tarjeta.setAttribute('data-numero', sticker.numero);
    
    const contenedorImagen = document.createElement('div');
    contenedorImagen.className = 'contenedor-imagen';
    
    const imagen = document.createElement('img');
    imagen.className = 'imagen-sticker';
    imagen.src = sticker.ruta;
    imagen.alt = `Sticker ${sticker.numero}`;
    imagen.loading = 'lazy'; // Carga diferida para mejor rendimiento
    
    // Manejo de error de carga de imagen
    imagen.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" font-size="14" text-anchor="middle" dy=".3em" fill="%23999"%3ENo disponible%3C/text%3E%3C/svg%3E';
    };
    
    const numeroSticker = document.createElement('p');
    numeroSticker.className = 'numero-sticker';
    numeroSticker.textContent = `#${sticker.numero}`;
    
    const botonAgregar = document.createElement('button');
    botonAgregar.className = 'boton-agregar-carrito';
    botonAgregar.textContent = 'Agregar al carrito';
    botonAgregar.onclick = (e) => {
        e.stopPropagation();
        agregarAlCarrito(sticker);
    };
    
    contenedorImagen.appendChild(imagen);
    tarjeta.appendChild(contenedorImagen);
    tarjeta.appendChild(numeroSticker);
    tarjeta.appendChild(botonAgregar);
    
    // Evento click para ampliar (opcional)
    tarjeta.addEventListener('click', (e) => {
        if (e.target !== botonAgregar) {
            ampliarSticker(sticker);
        }
    });
    
    return tarjeta;
}

// Función para ampliar un sticker (modal simple)
function ampliarSticker(sticker) {
    const existe = document.getElementById('modal-sticker');
    if (existe) {
        existe.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'modal-sticker';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: pointer;
    `;
    
    const contenedor = document.createElement('div');
    contenedor.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 15px;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        position: relative;
    `;
    
    // Botón de cerrar
    const botonCerrar = document.createElement('button');
    botonCerrar.innerHTML = '&times;';
    botonCerrar.style.cssText = `
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: #df98ff;
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 2rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        transition: all 0.3s ease;
    `;
    botonCerrar.onmouseover = () => {
        botonCerrar.style.background = '#c97aff';
        botonCerrar.style.transform = 'scale(1.1)';
    };
    botonCerrar.onmouseout = () => {
        botonCerrar.style.background = '#df98ff';
        botonCerrar.style.transform = 'scale(1)';
    };
    botonCerrar.onclick = (e) => {
        e.stopPropagation();
        modal.remove();
    };
    
    contenedor.appendChild(botonCerrar);
    
    // Contenedor de imagen con marca de agua
    const contenedorImagen = document.createElement('div');
    contenedorImagen.style.cssText = `
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Múltiples marcas de agua centradas y más arriba
    const posicionesMarcas = [
        { top: '0%', left: '70%' },
        { top: '15%', left: '80%' },
        { top: '30%', left: '90%' }
    ];
    
    posicionesMarcas.forEach((posicion, index) => {
        const marcaAgua = document.createElement('div');
        marcaAgua.textContent = 'Papelería de Sol • Papelería de Sol • Papelería de Sol';
        marcaAgua.style.cssText = `
            position: absolute;
            top: ${posicion.top};
            left: ${posicion.left};
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 1.5rem;
            font-weight: bold;
            color: rgba(152, 183, 255, 0.2);
            white-space: nowrap;
            pointer-events: none;
            z-index: 2;
            user-select: none;
            width: 200%;
        `;
        contenedorImagen.appendChild(marcaAgua);
    });
    
    const imagen = document.createElement('img');
    imagen.src = sticker.ruta;
    imagen.alt = `Sticker ${sticker.numero}`;
    imagen.style.cssText = `
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
        -webkit-touch-callout: none;
        pointer-events: none;
    `;
    
    const texto = document.createElement('h2');
    texto.textContent = `Sticker #${sticker.numero}`;
    texto.style.cssText = `
        color: #98b7ff;
        margin: 0;
        user-select: none;
    `;
    
    contenedorImagen.appendChild(imagen);
    contenedor.appendChild(texto);
    contenedor.appendChild(contenedorImagen);
    modal.appendChild(contenedor);
    
    // Protección contra clic derecho en el modal
    modal.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Protección contra arrastrar
    modal.addEventListener('dragstart', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Protección contra selección
    modal.addEventListener('selectstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });
    
    // Solo el botón X puede cerrar el modal
    contenedor.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.body.appendChild(modal);
}

// Función para renderizar stickers de la página actual
function renderizarStickers() {
    galeriaStickers.innerHTML = '';
    
    const totalPaginas = Math.ceil(stickersActuales.length / configuracion.stickersPorPagina);
    const inicio = (paginaActual - 1) * configuracion.stickersPorPagina;
    const fin = inicio + configuracion.stickersPorPagina;
    const stickersPagina = stickersActuales.slice(inicio, fin);
    
    if (stickersPagina.length === 0) {
        galeriaStickers.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white; font-size: 1.2rem;">No se encontraron stickers</p>';
        return;
    }
    
    // Usar un fragmento para mejor rendimiento
    const fragmento = document.createDocumentFragment();
    
    stickersPagina.forEach(sticker => {
        const tarjeta = crearTarjetaSticker(sticker);
        fragmento.appendChild(tarjeta);
    });
    
    galeriaStickers.appendChild(fragmento);
    actualizarControlesPaginacion(totalPaginas);
    ocultarMensajeCarga();
}

// Función para actualizar los controles de paginación
function actualizarControlesPaginacion(totalPaginas) {
    informacionPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    botonAnterior.disabled = paginaActual === 1;
    botonSiguiente.disabled = paginaActual >= totalPaginas;
    inputPagina.max = totalPaginas;
    inputPagina.placeholder = `1-${totalPaginas}`;
}

// Función para ocultar mensaje de carga
function ocultarMensajeCarga() {
    if (textoCargando) {
        textoCargando.classList.add('oculto');
    }
}

// Función para buscar stickers
function buscarStickers() {
    const terminoBusqueda = campoBusqueda.value.trim();
    
    if (terminoBusqueda === '') {
        stickersActuales = [...todosLosStickers];
    } else {
        const numero = parseInt(terminoBusqueda);
        if (!isNaN(numero) && numero >= 1 && numero <= configuracion.totalStickers) {
            stickersActuales = todosLosStickers.filter(sticker => 
                sticker.numero === numero || sticker.numero.toString().includes(terminoBusqueda)
            );
        } else {
            stickersActuales = todosLosStickers.filter(sticker => 
                sticker.numero.toString().includes(terminoBusqueda)
            );
        }
    }
    
    paginaActual = 1;
    renderizarStickers();
}

// Función para resetear búsqueda
function resetearBusqueda() {
    campoBusqueda.value = '';
    stickersActuales = [...todosLosStickers];
    paginaActual = 1;
    renderizarStickers();
}

// Función para ir a una página específica
function irAPaginaEspecifica() {
    const totalPaginas = Math.ceil(stickersActuales.length / configuracion.stickersPorPagina);
    const paginaDeseada = parseInt(inputPagina.value);
    
    if (isNaN(paginaDeseada) || paginaDeseada < 1) {
        alert('Por favor ingresa un número de página válido');
        return;
    }
    
    if (paginaDeseada > totalPaginas) {
        alert(`La página debe estar entre 1 y ${totalPaginas}`);
        return;
    }
    
    paginaActual = paginaDeseada;
    renderizarStickers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    inputPagina.value = '';
}

// Event listeners
botonAnterior.addEventListener('click', () => {
    if (paginaActual > 1) {
        paginaActual--;
        renderizarStickers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

botonSiguiente.addEventListener('click', () => {
    const totalPaginas = Math.ceil(stickersActuales.length / configuracion.stickersPorPagina);
    if (paginaActual < totalPaginas) {
        paginaActual++;
        renderizarStickers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

botonBuscar.addEventListener('click', buscarStickers);

botonResetear.addEventListener('click', resetearBusqueda);

campoBusqueda.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        buscarStickers();
    }
});

botonIrPagina.addEventListener('click', irAPaginaEspecifica);

inputPagina.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        irAPaginaEspecifica();
    }
});

// Navegación con teclado
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && !botonAnterior.disabled) {
        botonAnterior.click();
    } else if (e.key === 'ArrowRight' && !botonSiguiente.disabled) {
        botonSiguiente.click();
    }
});

// Protección de imágenes
function aplicarProteccionImagenes() {
    // Deshabilitar clic derecho en toda la galería
    galeriaStickers.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Deshabilitar arrastrar imágenes
    galeriaStickers.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });
    
    // Deshabilitar selección de imágenes
    galeriaStickers.addEventListener('selectstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });
}

// Protección de imágenes de plantillas
function aplicarProteccionPlantillas() {
    const galeriaPlantillas = document.getElementById('galeria-plantillas-san-valentin');
    console.log('Buscando galería de plantillas...', galeriaPlantillas);
    
    if (galeriaPlantillas) {
        console.log('Galería encontrada, aplicando protección...');
        
        // Deshabilitar clic derecho
        galeriaPlantillas.addEventListener('contextmenu', (e) => {
            console.log('Clic derecho bloqueado en plantilla');
            e.preventDefault();
            return false;
        });
        
        // Deshabilitar arrastrar imágenes
        galeriaPlantillas.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                return false;
            }
        });
        
        // Deshabilitar selección de imágenes
        galeriaPlantillas.addEventListener('selectstart', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                return false;
            }
        });
    } else {
        console.log('Galería NO encontrada');
    }
}

// Inicialización
function inicializar() {
    console.log('Inicializando catálogo de stickers...');
    generarListaStickers();
    renderizarStickers();
    aplicarProteccionImagenes();
    aplicarProteccionPlantillas();
    console.log(`Catálogo cargado con ${configuracion.totalStickers} stickers`);
}

// ===== FUNCIONES DEL CARRITO =====

// Cargar carrito desde localStorage
function cargarCarrito() {
    const carritoGuardado = localStorage.getItem('carritoStickers');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
        actualizarCarrito();
    }
}

// Guardar carrito en localStorage
function guardarCarrito() {
    localStorage.setItem('carritoStickers', JSON.stringify(carrito));
}

// Agregar sticker al carrito
function agregarAlCarrito(sticker) {
    const existe = carrito.find(item => item.tipo === 'sticker' && item.numero === sticker.numero);
    
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({ ...sticker, tipo: 'sticker', cantidad: 1 });
    }
    
    guardarCarrito();
    actualizarCarrito();
    mostrarNotificacion(`Sticker #${sticker.numero} agregado al carrito`);
}

// Agregar plantilla al carrito
function agregarPlantillaAlCarrito(nombre, categoria, numero, ruta) {
    const id = `plantilla-${categoria}-${numero}`;
    const existe = carrito.find(item => item.id === id);
    
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({
            id: id,
            tipo: 'plantilla',
            nombre: nombre,
            categoria: categoria,
            numero: numero,
            ruta: ruta,
            precio: 3500,
            cantidad: 1
        });
    }
    
    guardarCarrito();
    actualizarCarrito();
    mostrarNotificacion(`${nombre} agregado al carrito`);
}

// Agregar pack completo de plantillas San Valentín
function agregarPackPlantillas() {
    const id = 'pack-san-valentin';
    const existe = carrito.find(item => item.id === id);
    
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({
            id: id,
            tipo: 'plantilla',
            nombre: 'Pack San Valentín (8 diseños)',
            categoria: 'San Valentín',
            ruta: 'plantillas/san-valentin/descargable-01.jpeg', // Imagen representativa
            precio: 3500,
            cantidad: 1,
            esPack: true
        });
    }
    
    guardarCarrito();
    actualizarCarrito();
    mostrarNotificacion('Pack San Valentín agregado al carrito');
}

// Agregar plantilla editable Canva
function agregarCanvaAlCarrito() {
    const id = 'canva-san-valentin';
    const existe = carrito.find(item => item.id === id);
    
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({
            id: id,
            tipo: 'plantilla',
            nombre: 'Plantilla Editable Canva - San Valentín',
            categoria: 'San Valentín',
            ruta: 'plantillas/san-valentin/descargable-01.jpeg', // Imagen representativa
            precio: 1500,
            cantidad: 1,
            esCanva: true
        });
    }
    
    guardarCarrito();
    actualizarCarrito();
    mostrarNotificacion('Plantilla Canva agregada al carrito');
}

// Eliminar item del carrito
function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => {
        if (item.tipo === 'sticker') {
            return item.numero !== id;
        } else {
            return item.id !== id;
        }
    });
    guardarCarrito();
    actualizarCarrito();
}

// Cambiar cantidad de un item
function cambiarCantidad(id, cambio, tipo) {
    const item = carrito.find(item => {
        if (tipo === 'sticker') {
            return item.tipo === 'sticker' && item.numero === id;
        } else {
            return item.id === id;
        }
    });
    
    if (item) {
        item.cantidad += cambio;
        if (item.cantidad <= 0) {
            eliminarDelCarrito(id);
        } else {
            guardarCarrito();
            actualizarCarrito();
        }
    }
}

// Vaciar carrito
function vaciarCarrito() {
    if (carrito.length === 0) return;
    
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        carrito = [];
        guardarCarrito();
        actualizarCarrito();
        mostrarNotificacion('Carrito vaciado');
    }
}

// Actualizar visualización del carrito
function actualizarCarrito() {
    const totalCantidad = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    contadorCarrito.textContent = totalCantidad;
    totalItems.textContent = totalCantidad;
    
    if (carrito.length === 0) {
        contenidoCarrito.innerHTML = '<p class="carrito-vacio">El carrito está vacío</p>';
        return;
    }
    
    contenidoCarrito.innerHTML = '';
    carrito.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'item-carrito';
        
        const img = document.createElement('img');
        img.src = item.ruta;
        img.alt = item.tipo === 'sticker' ? `Sticker ${item.numero}` : item.nombre;
        img.className = 'item-carrito-imagen';
        
        const info = document.createElement('div');
        info.className = 'item-carrito-info';
        
        const nombre = document.createElement('div');
        nombre.className = 'item-carrito-numero';
        nombre.textContent = item.tipo === 'sticker' ? `Sticker #${item.numero}` : item.nombre;
        
        const cantidadContainer = document.createElement('div');
        cantidadContainer.className = 'item-carrito-cantidad';
        
        const botonMenos = document.createElement('button');
        botonMenos.className = 'boton-cantidad';
        botonMenos.textContent = '-';
        botonMenos.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = item.tipo === 'sticker' ? item.numero : item.id;
            cambiarCantidad(id, -1, item.tipo);
        });
        
        const cantidadValor = document.createElement('span');
        cantidadValor.className = 'cantidad-valor';
        cantidadValor.textContent = item.cantidad;
        
        const botonMas = document.createElement('button');
        botonMas.className = 'boton-cantidad';
        botonMas.textContent = '+';
        botonMas.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = item.tipo === 'sticker' ? item.numero : item.id;
            cambiarCantidad(id, 1, item.tipo);
        });
        
        const botonEliminar = document.createElement('button');
        botonEliminar.className = 'boton-eliminar-item';
        botonEliminar.textContent = '×';
        botonEliminar.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = item.tipo === 'sticker' ? item.numero : item.id;
            eliminarDelCarrito(id);
        });
        
        cantidadContainer.appendChild(botonMenos);
        cantidadContainer.appendChild(cantidadValor);
        cantidadContainer.appendChild(botonMas);
        
        info.appendChild(nombre);
        info.appendChild(cantidadContainer);
        
        itemElement.appendChild(img);
        itemElement.appendChild(info);
        itemElement.appendChild(botonEliminar);
        
        contenidoCarrito.appendChild(itemElement);
    });
}

// Abrir/cerrar carrito
function toggleCarrito() {
    panelCarrito.classList.toggle('abierto');
}

// Enviar pedido por WhatsApp
function enviarPedido() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    
    let mensaje = 'Hola! Me gustaria hacer el siguiente pedido:\n\n';
    
    const stickers = carrito.filter(item => item.tipo === 'sticker');
    const plantillas = carrito.filter(item => item.tipo === 'plantilla');
    
    if (stickers.length > 0) {
        mensaje += '=== STICKERS ===\n';
        stickers.forEach(item => {
            mensaje += `Sticker #${item.numero} - Cantidad: ${item.cantidad}\n`;
        });
        mensaje += '\n';
    }
    
    if (plantillas.length > 0) {
        mensaje += '=== PLANTILLAS PDF ===\n';
        plantillas.forEach(item => {
            mensaje += `${item.nombre} - Cantidad: ${item.cantidad}\n`;
            mensaje += `Precio unitario: $${item.precio.toLocaleString('es-AR')}\n`;
        });
        mensaje += '\n';
    }
    
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    mensaje += `Total de items: ${totalItems}`;
    mensaje += '\n\nGracias!';
    
    const url = `https://wa.me/${configuracion.numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// Mostrar notificación
function mostrarNotificacion(texto) {
    const notif = document.createElement('div');
    notif.textContent = texto;
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #98b7ff 0%, #df98ff 100%);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

// Event listeners del carrito
botonCarrito.addEventListener('click', toggleCarrito);
cerrarCarrito.addEventListener('click', toggleCarrito);
botonEnviarPedido.addEventListener('click', enviarPedido);
botonVaciarCarrito.addEventListener('click', vaciarCarrito);

// Cerrar carrito al hacer click fuera
document.addEventListener('click', (e) => {
    if (panelCarrito.classList.contains('abierto') && 
        !panelCarrito.contains(e.target) && 
        !botonCarrito.contains(e.target)) {
        toggleCarrito();
    }
});

// Cargar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cargarCarrito();
        // No inicializar catálogo automáticamente, solo cuando se acceda a esa sección
    });
} else {
    cargarCarrito();
    // No inicializar catálogo automáticamente, solo cuando se acceda a esa sección
}

// Función para inicializar el catálogo (se llama cuando se accede a la sección)
function inicializarCatalogo() {
    inicializar();
}
