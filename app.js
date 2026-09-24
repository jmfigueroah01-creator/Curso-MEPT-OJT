/* ============================================================
   CONFIGURACIÓN — AJUSTA ESTOS VALORES
   ============================================================ */

const DOMINIO_INSTITUCIONAL = "@afac.gob.mx";

// URLs de los dos flujos de Power Automate para el código de acceso.
const URL_ENVIAR_CODIGO = "https://defaultb7c9bdfffd974461ab1bd2a2813f8b.a4.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/10/workflows/ba842193e68f400998fc6341ccaa467c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=C3iuWkiPu8P7CBwgNp9rZLmnA2O71bzkBs0tO94wNoA";
const URL_VALIDAR_CODIGO = "https://defaultb7c9bdfffd974461ab1bd2a2813f8b.a4.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/26/workflows/99a974f68f4b410697ac1202e178d13d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FiEyhSJ-qHuIAB-OcC0EoN3ZxaxDMzXtqr1t2oKs0gI";
const URL_VERIFICAR_SESION = "https://defaultb7c9bdfffd974461ab1bd2a2813f8b4.a4.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/21/workflows/ffe6d7e4bf2d43a3b9b52c6ed5d06a86/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=AG4AMv9-mCbUgispAE0r7ElUAdmPXUYAz8CnSqRTT4w";

// URL del flujo que registra progreso (correo + evento + fecha).
const WEBHOOK_URL = "";

// Link a tu Microsoft Form oficial de evaluación.
const LINK_EVALUACION_OFICIAL = "https://forms.office.com/r/TU_ID_AQUI";

let TOTAL_MODULOS = 0;
let MODULOS = {};
let moduloEnPantalla = null;
let RESPUESTAS_QUIZ = {};

function cargarContenidoCurso() {
    return fetch("contenido-curso.json")
        .then(resp => resp.json())
        .then(data => {
            MODULOS = data.modulos || {};
            RESPUESTAS_QUIZ = data.respuestas || {};
            TOTAL_MODULOS = Object.keys(MODULOS).length;
        });
}


/* ============================================================
   ACCESO — PASO 1: PEDIR CORREO Y ENVIAR CÓDIGO
   ============================================================ */

let correoPendiente = "";
let cooldownReenviar = false;

function obtenerCorreo() {
    return localStorage.getItem("correoUsuario");
}

function obtenerToken() {
    return localStorage.getItem("tokenSesion");
}

function obtenerNombre() {
    return localStorage.getItem("nombreUsuario");
}

function validarCorreoInstitucional(correo) {
    return typeof correo === "string" &&
        correo.trim().toLowerCase().endsWith(DOMINIO_INSTITUCIONAL.toLowerCase());
}

function mostrarPasoModal(id) {
    document.querySelectorAll(".paso-modal").forEach(p => p.classList.remove("activo"));
    document.getElementById(id).classList.add("activo");
}

function mostrarPantallaCarga(mostrar) {
    document.getElementById("pantallaCarga").classList.toggle("oculto", !mostrar);
}

function mostrarModal(mostrar) {
    document.getElementById("modalAcceso").classList.toggle("oculto", !mostrar);
}

function solicitarCodigo() {
    const input = document.getElementById("inputCorreo");
    const error = document.getElementById("errorCorreo");
    const correo = input.value.trim().toLowerCase();

    if (!validarCorreoInstitucional(correo)) {
        error.textContent = "El correo ingresado no tiene un formato válido. Debe ser nombre.apellido@afac.gob.mx";
        error.style.display = "block";
        return;
    }

    error.style.display = "none";
    correoPendiente = correo;

    const boton = document.getElementById("btnEnviarCodigo");
    boton.disabled = true;
    boton.textContent = "Enviando...";

    enviarCodigoAlServidor(correo)
        .then(() => {
            boton.disabled = false;
            boton.textContent = "Enviar código";
            document.getElementById("correoParaCodigo").textContent = correo;
            document.getElementById("inputCodigo").value = "";
            mostrarPasoModal("pasoCodigo");
            iniciarCooldownReenvio();
        })
        .catch((err) => {
            boton.disabled = false;
            boton.textContent = "Enviar código";
            error.textContent = (err && err.message)
                ? err.message
                : "No se pudo enviar el código. Intenta de nuevo en unos segundos.";
            error.style.display = "block";
        });
}

function enviarCodigoAlServidor(correo) {
    if (!URL_ENVIAR_CODIGO) {
        return Promise.reject(new Error("URL_ENVIAR_CODIGO no configurada"));
    }

    return fetch(URL_ENVIAR_CODIGO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo })
    })
        .then(resp => resp.json().catch(() => ({})))
        .then(data => {
            if (!data || data.enviado !== true) {
                throw new Error(
                    (data && data.mensaje) ? data.mensaje : "El servidor no pudo enviar el código"
                );
            }
        });
}

function reenviarCodigo() {
    if (cooldownReenviar) return;

    const link = document.getElementById("linkReenviar");
    const confirmacion = document.getElementById("confirmacionReenvio");
    const error = document.getElementById("errorCodigo");

    error.style.display = "none";
    confirmacion.style.display = "none";
    link.style.pointerEvents = "none";
    const textoOriginal = link.textContent;
    link.textContent = "Enviando...";

    enviarCodigoAlServidor(correoPendiente)
        .then(() => {
            confirmacion.textContent = "Código reenviado. Revisa tu correo.";
            confirmacion.style.display = "block";
            link.textContent = textoOriginal;

            setTimeout(() => {
                confirmacion.style.display = "none";
                link.style.pointerEvents = "";
                iniciarCooldownReenvio();
            }, 10000);
        })
        .catch((err) => {
            link.style.pointerEvents = "";
            link.textContent = textoOriginal;
            error.textContent = (err && err.message)
                ? err.message
                : "No se pudo reenviar el código. Intenta de nuevo.";
            error.style.display = "block";
        });
}

function iniciarCooldownReenvio() {
    cooldownReenviar = true;
    const link = document.getElementById("linkReenviar");
    let segundos = 60;
    link.textContent = "Reenviar código (" + segundos + "s)";

    const intervalo = setInterval(() => {
        segundos--;
        if (segundos <= 0) {
            clearInterval(intervalo);
            cooldownReenviar = false;
            link.textContent = "Reenviar código";
        } else {
            link.textContent = "Reenviar código (" + segundos + "s)";
        }
    }, 1000);
}

function volverACorreo() {
    document.getElementById("errorCodigo").style.display = "none";
    mostrarPasoModal("pasoCorreo");
}


/* ============================================================
   ACCESO — PASO 2: CONFIRMAR CÓDIGO
   ============================================================ */

function confirmarCodigo() {
    const input = document.getElementById("inputCodigo");
    const error = document.getElementById("errorCodigo");
    const codigo = input.value.trim();

    if (!/^\d{6}$/.test(codigo)) {
        error.textContent = "Ingresa los 6 dígitos del código.";
        error.style.display = "block";
        return;
    }

    const boton = document.getElementById("btnConfirmarCodigo");
    boton.disabled = true;
    boton.textContent = "Verificando...";

    mostrarModal(false);
    mostrarPantallaCarga(true);

    // Se adelanta la carga del contenido del curso en paralelo a la
    // validación del código, para no esperar una cosa y luego la otra.
    const promesaContenido = cargarContenidoCurso();

    validarCodigoEnServidor(correoPendiente, codigo)
        .then(data => {
            boton.disabled = false;
            boton.textContent = "Confirmar";

            if (!data || data.valido !== true) {
                mostrarPantallaCarga(false);
                mostrarModal(true);
                error.textContent = "Código incorrecto o vencido. Solicita uno nuevo.";
                error.style.display = "block";
                return;
            }

            localStorage.setItem("correoUsuario", correoPendiente);
            localStorage.setItem("tokenSesion", data.token || "");
            localStorage.setItem("nombreUsuario", data.nombre || "");
            error.style.display = "none";
            mostrarApp(promesaContenido);
            registrarEvento("acceso", null);
        })
        .catch(() => {
            boton.disabled = false;
            boton.textContent = "Confirmar";
            mostrarPantallaCarga(false);
            mostrarModal(true);
            error.textContent = "No se pudo verificar el código. Intenta de nuevo.";
            error.style.display = "block";
        });
}

function validarCodigoEnServidor(correo, codigo) {
    if (!URL_VALIDAR_CODIGO) {
        return Promise.reject(new Error("URL_VALIDAR_CODIGO no configurada"));
    }

    return fetch(URL_VALIDAR_CODIGO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo, codigo: codigo })
    })
        .then(resp => resp.json());
}


/* ============================================================
   MOSTRAR APP Y CERRAR SESIÓN
   ============================================================ */

function mostrarApp(promesaContenido) {
    mostrarModal(false);
    mostrarPantallaCarga(true);

    const promesa = promesaContenido || cargarContenidoCurso();

    promesa
        .then(() => {
            mostrarPantallaCarga(false);
            document.getElementById("appCurso").style.display = "";

            const correoMostrado = document.getElementById("correoMenuUsuario");
            if (correoMostrado) correoMostrado.textContent = obtenerCorreo() || "";

            const saludoUsuario = document.getElementById("saludoUsuario");
            const headerUsuario = document.getElementById("headerUsuario");
            const nombre = obtenerNombre();
            if (saludoUsuario) {
                saludoUsuario.textContent = nombre ? nombre.trim().split(/\s+/).slice(0, 2).join(" ") : "";
            }
            if (headerUsuario) {
                headerUsuario.classList.toggle("visible", Boolean(nombre));
            }

            const saludoBienvenida = document.getElementById("saludoBienvenida");
            if (saludoBienvenida) {
                const primerNombre = nombre ? nombre.trim().split(/\s+/)[0] : "";
                saludoBienvenida.textContent = primerNombre ? `Bienvenido(a), ${primerNombre}` : "Bienvenido(a)";
            }

            cargarProgreso();
            renderRuta();
            actualizarProgreso();
        })
        .catch(() => {
            mostrarPantallaCarga(false);
            alert("No se pudo cargar el contenido del curso. Verifica tu conexión y recarga la página.");
        });
}

function mostrarModalConMensaje(mensaje) {
    mostrarPantallaCarga(false);
    mostrarModal(true);
    document.getElementById("appCurso").style.display = "none";
    mostrarPasoModal("pasoCorreo");

    if (mensaje) {
        const error = document.getElementById("errorCorreo");
        error.textContent = mensaje;
        error.style.display = "block";
    }
}

function verificarSesionEnServidor(correo, token) {
    if (!URL_VERIFICAR_SESION) {
        return Promise.reject(new Error("URL_VERIFICAR_SESION no configurada"));
    }

    return fetch(URL_VERIFICAR_SESION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo, token: token })
    })
        .then(resp => resp.json());
}

function verificarAccesoAlCargar() {
    const correo = obtenerCorreo();
    const token = obtenerToken();

    const DURACION_MINIMA_CARGA = 400; // ms

    if (!validarCorreoInstitucional(correo) || !token) {
        setTimeout(() => mostrarModalConMensaje(""), DURACION_MINIMA_CARGA);
        return;
    }

    const inicioCarga = Date.now();

    function despuesDeMinimo(callback) {
        const transcurrido = Date.now() - inicioCarga;
        const falta = DURACION_MINIMA_CARGA - transcurrido;
        if (falta > 0) {
            setTimeout(callback, falta);
        } else {
            callback();
        }
    }

    verificarSesionEnServidor(correo, token)
        .then(data => {
            if (!data || data.valido !== true) {
                cerrarSesion(true);
                despuesDeMinimo(() => mostrarModalConMensaje(
                    (data && data.mensaje) ? data.mensaje : "Tu sesión ya no es válida. Ingresa de nuevo."
                ));
                return;
            }

            if (data.nombre) {
                localStorage.setItem("nombreUsuario", data.nombre);
            }
            despuesDeMinimo(() => mostrarApp());
        })
        .catch(() => {
            // Si no se pudo contactar al servidor, no cerramos la sesión de golpe:
            // dejamos entrar con lo que ya había en localStorage para no bloquear
            // por un problema de red pasajero.
            despuesDeMinimo(() => mostrarApp());
        });
}

function alternarMenuUsuario() {
    const menu = document.getElementById("menuUsuario");
    if (!menu) return;
    menu.classList.toggle("visible");
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("menuUsuario");
    const header = document.getElementById("headerUsuario");
    if (menu && menu.classList.contains("visible") && header && !header.contains(e.target)) {
        menu.classList.remove("visible");
    }
});

function cerrarSesion(silencioso) {
    const continuar = silencioso === true
        ? true
        : confirm("Esto cerrará tu sesión en este dispositivo (no borra tu avance). ¿Continuar?");

    if (continuar) {
        localStorage.removeItem("correoUsuario");
        localStorage.removeItem("tokenSesion");
        localStorage.removeItem("nombreUsuario");
        if (!silencioso) location.reload();
    }
}


/* ============================================================
   REGISTRO DE EVENTOS (Power Automate)
   ============================================================ */

function registrarEvento(tipo, numeroModulo) {
    if (!WEBHOOK_URL) return;

    fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            correo: obtenerCorreo(),
            tipo: tipo,
            modulo: numeroModulo,
            fecha: new Date().toISOString()
        })
    }).catch(error => console.warn("No se pudo registrar el evento:", error));
}


/* ============================================================
   PROGRESO (local, por correo)
   ============================================================ */

let progreso = { modulo1: false, modulo2: false, modulo3: false };

function claveProgreso() {
    return "progresoCurso_" + (obtenerCorreo() || "anonimo");
}

function cargarProgreso() {
    const guardado = localStorage.getItem(claveProgreso());
    progreso = guardado
        ? JSON.parse(guardado)
        : { modulo1: false, modulo2: false, modulo3: false };
}

function guardarProgreso() {
    localStorage.setItem(claveProgreso(), JSON.stringify(progreso));
}


/* ============================================================
   NAVEGACIÓN ENTRE SECCIONES
   ============================================================ */

function mostrarSeccion(id) {
    if (id === "evaluacion" && !todosLosModulosCompletos()) {
        alert("Debes completar el módulo 3 antes de acceder a la evaluación.");
        return;
    }

    document.querySelectorAll(".seccion").forEach(s => s.classList.remove("activa"));
    document.getElementById(id).classList.add("activa");

    document.querySelectorAll("#menuNav button").forEach(b => {
        b.classList.toggle("activo", b.dataset.sec === id);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}


/* ============================================================
   BLOQUEO SECUENCIAL Y RUTA DE MÓDULOS
   ============================================================ */

function estaDesbloqueado(numero) {
    if (numero === 1) return true;
    return progreso["modulo" + (numero - 1)] === true;
}

function todosLosModulosCompletos() {
    for (let n = 1; n <= TOTAL_MODULOS; n++) {
        if (!progreso["modulo" + n]) return false;
    }
    return true;
}

function renderRuta() {
    const cont = document.getElementById("rutaModulos");
    if (!cont) return;

    let html = "";

    for (let n = 1; n <= TOTAL_MODULOS; n++) {
        const desbloqueado = estaDesbloqueado(n);
        const completo = progreso["modulo" + n];
        const m = MODULOS[n];

        const marcadorClase = completo ? "completo" : (desbloqueado ? "activo" : "");
        const marcadorContenido = completo
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M5 12.5 L10 17.5 L19 7"/></svg>'
            : (desbloqueado ? ("0" + n) : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10 V7 a4 4 0 0 1 8 0 v3"/></svg>');

        html += `
        <div class="modulo ${completo ? 'completo' : ''}">
            <div class="marcador ${marcadorClase}">${marcadorContenido}</div>
            <div class="modulo-cuerpo">
                <h3>${m.titulo}</h3>
                <p>${m.resumen}</p>
                <button class="${desbloqueado ? 'desbloqueado' : ''}" ${desbloqueado ? '' : 'disabled'} onclick="abrirModulo(${n})">
                    ${!desbloqueado ? 'Bloqueado' : (completo ? 'Repasar' : 'Ingresar')}
                </button>
            </div>
        </div>`;
    }

    cont.innerHTML = html;

    const btnEval = document.getElementById("btnIrEvaluacion");
    if (btnEval) btnEval.disabled = !todosLosModulosCompletos();
}


/* ============================================================
   CONTENIDO DE MÓDULOS
   ============================================================ */

/* ============================================================
   PRESENTACIÓN DEL MÓDULO (PowerPoint)
   ============================================================
   Cuando m.presentacion tenga el nombre de archivo (ej. "modulo1.pptx"),
   subido al mismo repositorio que index.html, se muestra embebido con
   el visor de Office Online. Mientras esté vacío, muestra "Próximamente".
   ============================================================ */

/* ============================================================
   INFOGRAMA DEL MÓDULO (resumen visual descargable)
   ============================================================
   Cuando m.infograma tenga el nombre de archivo (ej. "infograma-modulo1.pdf"
   o ".png"), subido al mismo repositorio, se muestra la tarjeta de descarga.
   Mientras esté vacío, muestra "Próximamente".
   ============================================================ */

function renderInfograma(m) {
    if (!m.infograma) {
        return `
            <div class="presentacion-proximamente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16V10M12 16V8M16 16v-5"/></svg>
                <p>Infograma en preparación — próximamente disponible.</p>
            </div>
        `;
    }

    const urlArchivo = new URL(m.infograma, window.location.href).href;

    return `
        <a class="infograma-descarga" href="${urlArchivo}" target="_blank" rel="noopener">
            <span class="infograma-descarga-icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16V10M12 16V8M16 16v-5"/></svg></span>
            <span class="infograma-descarga-texto">
                <strong>Descargar infograma</strong>
                <span>Resumen visual del módulo, en formato imprimible.</span>
            </span>
            <span class="infograma-descarga-flecha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 19h14"/></svg></span>
        </a>
    `;
}

function renderPresentacionModulo(m, numero) {
    if (!m.presentacion) {
        return `
            <div class="bloque">
            <div class="bloque-titulo"><span class="bloque-num">P</span>Presentación del módulo</div>
            <div class="presentacion-proximamente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20"/></svg>
                <p>Presentación en preparación — próximamente disponible.</p>
            </div>
            </div>
        `;
    }

    const urlArchivo = new URL(m.presentacion, window.location.href).href;
    const urlVisor = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(urlArchivo);
    const botonPdf = m.presentacion_pdf
        ? `<a class="btn-secundario" href="${new URL(m.presentacion_pdf, window.location.href).href}" target="_blank" rel="noopener">Descargar PDF</a>`
        : "";

    return `
        <div class="bloque">
        <div class="bloque-titulo"><span class="bloque-num">P</span>Presentación del módulo</div>
        <div class="presentacion-embebida">
            <iframe src="${urlVisor}" frameborder="0" allowfullscreen></iframe>
        </div>
        <div class="presentacion-acciones">
            <a class="btn-secundario" href="${urlVisor}" target="_blank" rel="noopener">Ver en pantalla completa</a>
            ${botonPdf}
        </div>
        </div>
    `;
}

function abrirModulo(numero) {
    if (!estaDesbloqueado(numero)) {
        alert("Primero debes completar el módulo " + (numero - 1) + ".");
        return;
    }

    const m = MODULOS[numero];
    const contenido = document.getElementById("contenidoModulo");
    const yaCompleto = !!progreso["modulo" + numero];
    moduloEnPantalla = numero;

    contenido.innerHTML = `
        <div class="contenido">
            <div class="modulo-cabecera">
                <h2>Módulo ${numero} — ${m.titulo}</h2>
                <span class="capitulo-tag">${m.capitulo_mept}</span>
            </div>

            <div class="objetivo-desempeno">
                <span class="objetivo-desempeno-icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg></span>
                <div>
                    <span>Al terminar podrás</span>
                    <p>${m.objetivo_desempeno}</p>
                </div>
            </div>

            <p class="temario-eyebrow">Temario de este módulo</p>
            <ul class="temario-lista">
                ${m.temario.map((tema, i) => `<li><span class="temario-num">${numero}.${i + 1}</span>${tema}</li>`).join("")}
            </ul>

            <div class="modulo-acordeon">

                <div class="acc-seccion acc-abierta">
                    <button type="button" class="acc-header" onclick="alternarAcordeon(this)">
                        <svg class="acc-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20"/></svg>
                        <span class="acc-titulo">Presentación</span>
                        <svg class="acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg>
                    </button>
                    <div class="acc-body">
                        ${renderPresentacionModulo(m, numero)}
                    </div>
                </div>

                <div class="acc-seccion">
                    <button type="button" class="acc-header" onclick="alternarAcordeon(this)">
                        <svg class="acc-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16V10M12 16V8M16 16v-5"/></svg>
                        <span class="acc-titulo">Infograma</span>
                        <svg class="acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg>
                    </button>
                    <div class="acc-body" style="display:none;">
                        ${renderInfograma(m)}
                    </div>
                </div>

                <div class="acc-seccion">
                    <button type="button" class="acc-header" onclick="alternarAcordeon(this)">
                        <svg class="acc-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="9" width="14" height="11" rx="1.5"/><path d="M8 9V6.5a4 4 0 0 1 8 0V9"/></svg>
                        <span class="acc-titulo">Actividad del módulo</span>
                        <svg class="acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg>
                    </button>
                    <div class="acc-body" style="display:none;">

                        ${m.actividad_html}

                        <button class="btn-principal" style="width:auto;" id="btnCompletarModulo${numero}" onclick="completarModulo(${numero})" ${yaCompleto ? "" : "disabled"}>
                            ${yaCompleto ? "Módulo completado ✓ (repasar no reinicia tu progreso)" : "Completa la actividad de arriba para habilitar este botón"}
                        </button>

                    </div>
                </div>

            </div>
        </div>
    `;

    barajarDinamicaEmparejar();
    barajarIncumplimientos();
    barajarVerdaderoFalso();
    contenido.scrollIntoView({ behavior: "smooth" });
}

function barajarDinamicaEmparejar() {
    const contenedor = document.querySelector(".dinamica-columnas");
    if (!contenedor) return;

    const figuras = Array.from(contenedor.querySelectorAll(".figura-btn"));
    const funciones = Array.from(contenedor.querySelectorAll(".funcion-btn"));
    if (!figuras.length || !funciones.length) return;

    const barajar = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    const figurasBarajadas = barajar(figuras);
    const funcionesBarajadas = barajar(funciones);

    contenedor.innerHTML = "";
    for (let i = 0; i < figurasBarajadas.length; i++) {
        contenedor.appendChild(figurasBarajadas[i]);
        contenedor.appendChild(funcionesBarajadas[i]);
    }

    colorearDinamicaAleatoria(figurasBarajadas, funcionesBarajadas);
}

const PALETA_FIGURAS = ["#185FA5", "#993556", "#0E2A47", "#0F6E56", "#534AB7", "#993C1D"];
const PALETA_SITUACIONES = ["#B98A2E", "#0F766E", "#7C3F9E", "#B5541D", "#1D6FA5", "#5B6E3F"];

function colorearDinamicaAleatoria(figuras, funciones) {
    const barajar = (arr) => {
        const copia = [...arr];
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    };

    const coloresFiguras = barajar(PALETA_FIGURAS);
    const coloresSituaciones = barajar(PALETA_SITUACIONES);

    figuras.forEach((btn, i) => {
        const icono = btn.querySelector(".dinamica-icono");
        if (icono) icono.style.setProperty("--color-icono", coloresFiguras[i % coloresFiguras.length]);
    });
    funciones.forEach((btn, i) => {
        const icono = btn.querySelector(".dinamica-icono");
        if (icono) icono.style.setProperty("--color-icono", coloresSituaciones[i % coloresSituaciones.length]);
    });
}

function alternarAcordeon(boton) {
    const seccion = boton.closest(".acc-seccion");
    const body = seccion.querySelector(".acc-body");
    const abierta = seccion.classList.contains("acc-abierta");

    if (abierta) {
        seccion.classList.remove("acc-abierta");
        body.style.display = "none";
    } else {
        seccion.classList.add("acc-abierta");
        body.style.display = "block";
    }
}

function verificarCheckpoint(numero) {
    const seleccion = document.querySelector(`input[name="checkpoint${numero}"]:checked`);
    const feedback = document.getElementById(`checkpointFeedback${numero}`);
    const btnCompletar = document.getElementById(`btnCompletarModulo${numero}`);
    const chk = MODULOS[numero].checkpoint;

    if (!seleccion) {
        feedback.className = "checkpoint-feedback visible incorrecto";
        feedback.innerHTML = "Selecciona una opción antes de verificar.";
        return;
    }

    const esCorrecta = seleccion.value === chk.correcta;
    feedback.className = "checkpoint-feedback visible " + (esCorrecta ? "correcto" : "incorrecto");
    feedback.innerHTML = (esCorrecta ? "✓ Correcto. " : "Aún no. ") + chk.explicacion;

    if (esCorrecta && btnCompletar) {
        btnCompletar.disabled = false;
        btnCompletar.textContent = "Marcar módulo como completado";
    }
}

function completarModulo(numero) {
    progreso["modulo" + numero] = true;
    guardarProgreso();
    registrarEvento("modulo_completado", numero);

    renderRuta();
    actualizarProgreso();
    document.getElementById("contenidoModulo").innerHTML = "";

    if (numero === TOTAL_MODULOS) {
        alert("Módulo completado. Ya puedes acceder a la evaluación final.");
    } else {
        alert("Módulo completado correctamente.");
    }
}


/* ============================================================
   EVALUACIÓN
   ============================================================ */

function irAEvaluacionOficial() {
    if (!todosLosModulosCompletos()) {
        alert("Debes completar el módulo 3 antes de continuar.");
        return;
    }

    registrarEvento("inicio_evaluacion_oficial", null);
    window.open(LINK_EVALUACION_OFICIAL, "_blank");
}

// Autoevaluación de práctica — NO es la calificación oficial.
function calificar() {
    const respuestas = RESPUESTAS_QUIZ;
    let puntos = 0;

    Object.keys(respuestas).forEach(pregunta => {
        const seleccion = document.querySelector(`input[name="${pregunta}"]:checked`);
        if (seleccion && seleccion.value === respuestas[pregunta]) {
            puntos++;
        }
    });

    const porcentaje = Math.round((puntos / 3) * 100);
    const resultado = document.getElementById("resultado");
    resultado.style.display = "block";

    resultado.innerHTML = porcentaje >= 80
        ? `Buen resultado en la práctica: ${porcentaje}%. Ya puedes continuar a la evaluación final en Microsoft Forms.`
        : `Resultado de práctica: ${porcentaje}%. Revise nuevamente los contenidos antes de ir a la evaluación final.`;
}


/* ============================================================
   BARRA DE PROGRESO
   ============================================================ */

function actualizarProgreso() {
    const vals = [];
    for (let n = 1; n <= TOTAL_MODULOS; n++) vals.push(progreso["modulo" + n]);

    const completados = vals.filter(Boolean).length;
    const porcentaje = Math.round((completados / TOTAL_MODULOS) * 100);

    const barra = document.getElementById("barraProgreso");
    const texto = document.getElementById("porcentaje");
    if (barra) barra.style.width = porcentaje + "%";
    if (texto) texto.innerText = porcentaje + "% completado";

    const estado = document.getElementById("estadoModulos");
    if (estado) {
        let html = "";
        for (let n = 1; n <= TOTAL_MODULOS; n++) {
            html += `<div class="estado-linea">${progreso["modulo" + n] ? "✓" : "○"} Módulo ${n} — ${MODULOS[n].titulo}</div>`;
        }
        estado.innerHTML = html;
    }
}

function reiniciarCurso() {
    if (confirm("¿Desea reiniciar todo el progreso de este curso?")) {
        localStorage.removeItem(claveProgreso());
        location.reload();
    }
}


/* ============================================================
   TOUR DE BIENVENIDA (sección Inicio)
   ============================================================ */

let pasoActual = 1;
const TOTAL_PASOS = 7;

function irPaso(n) {
    pasoActual = n;
    document.querySelectorAll(".paso-tour").forEach(p => p.classList.remove("activo"));
    document.getElementById("paso" + n).classList.add("activo");

    document.querySelectorAll(".ruta-punto").forEach(p => {
        const num = Number(p.dataset.paso);
        p.classList.toggle("activo", num === n);
        p.classList.toggle("completado", num < n);
    });

    document.querySelectorAll(".ruta-punto-linea").forEach(linea => {
        const idx = Number(linea.dataset.linea);
        linea.classList.toggle("completado", idx < n);
    });

    const etiquetas = ["Bienvenida", "Contenido temático", "Objetivo general", "Método de trabajo", "Reglas", "Recursos", "Evaluación"];
    const contador = document.getElementById("rutaContador");
    if (contador) contador.textContent = `Paso ${n} de ${TOTAL_PASOS} · ${etiquetas[n - 1]}`;

    const btnAtras = document.getElementById("btnAtras");
    const btnSiguiente = document.getElementById("btnSiguiente");
    if (btnAtras) btnAtras.style.visibility = n === 1 ? "hidden" : "visible";
    if (btnSiguiente) btnSiguiente.textContent = n === TOTAL_PASOS ? "Ir al curso →" : "Siguiente →";
}

function mostrarPaso(n) {
    irPaso(n);
}

function siguientePaso() {
    if (pasoActual === TOTAL_PASOS) {
        mostrarSeccion("curso");
        return;
    }
    irPaso(pasoActual + 1);
}

function pasoAnterior() {
    if (pasoActual > 1) irPaso(pasoActual - 1);
}


/* ============================================================
   ARRANQUE
   ============================================================ */

verificarAccesoAlCargar();
irPaso(1);


/* ============================================================
   DINÁMICA "FIGURA ↔ FUNCIÓN" (Módulo 1)
   ============================================================ */

function clickFigura(boton) {
    if (boton.classList.contains("emparejado")) return;
    document.querySelectorAll(".figura-btn.seleccionado").forEach(b => b.classList.remove("seleccionado"));
    boton.classList.add("seleccionado");
    intentarEmparejarDinamica();
}

function clickFuncion(boton) {
    if (boton.classList.contains("emparejado")) return;
    document.querySelectorAll(".funcion-btn.seleccionado").forEach(b => b.classList.remove("seleccionado"));
    boton.classList.add("seleccionado");
    intentarEmparejarDinamica();
}

function verificarOrdenEtapas() {
    const filas = document.querySelectorAll(".orden-fila");
    let correctas = 0;
    let contestadas = 0;
    const usados = new Set();

    filas.forEach(fila => {
        const valor = fila.querySelector(".orden-select").value;
        fila.classList.remove("incumplimiento-ok", "incumplimiento-mal");
        if (!valor) return;
        contestadas++;
        usados.add(valor);
        if (valor === fila.dataset.correcta) {
            correctas++;
            fila.classList.add("incumplimiento-ok");
        } else {
            fila.classList.add("incumplimiento-mal");
        }
    });

    const total = filas.length;
    const resultado = document.getElementById("ordenEtapasResultado");
    if (!resultado) return;
    resultado.style.display = "block";

    if (contestadas < total) {
        resultado.className = "clasificacion-resultado aviso";
        resultado.textContent = `Asigna una posición a las ${total} etapas antes de verificar (llevas ${contestadas}).`;
        filas.forEach(f => f.classList.remove("incumplimiento-ok", "incumplimiento-mal"));
        return;
    }
    if (usados.size < total) {
        resultado.className = "clasificacion-resultado aviso";
        resultado.textContent = "Cada número del 1 al 6 debe usarse una sola vez.";
        filas.forEach(f => f.classList.remove("incumplimiento-ok", "incumplimiento-mal"));
        return;
    }

    const acerto = correctas === total;
    resultado.className = "clasificacion-resultado " + (acerto ? "correcto" : "incorrecto");
    resultado.textContent = acerto
        ? "¡Correcto! Ordenaste las seis etapas del proceso."
        : `Ubicaste ${correctas} de ${total} etapas en su posición. Revisa las marcadas en rojo e inténtalo de nuevo.`;

    if (acerto) {
        const retro = document.getElementById("retroalimentacionOrden");
        if (retro) retro.style.display = "block";
        habilitarBotonCompletar(moduloEnPantalla);
    }
}

function habilitarBotonCompletar(numero) {
    const btn = document.getElementById(`btnCompletarModulo${numero}`);
    if (!btn) return;
    if (progreso["modulo" + numero]) return;
    btn.disabled = false;
    btn.textContent = "Marcar módulo como completado";
}

function intentarEmparejarDinamica() {
    const f = document.querySelector(".figura-btn.seleccionado");
    const g = document.querySelector(".funcion-btn.seleccionado");
    if (!f || !g) return;

    if (f.dataset.id === g.dataset.id) {
        f.classList.remove("seleccionado");
        g.classList.remove("seleccionado");
        f.classList.add("emparejado");
        g.classList.add("emparejado");

        const total = document.querySelectorAll(".figura-btn").length;
        const hechos = document.querySelectorAll(".figura-btn.emparejado").length;
        const contador = document.getElementById("dinamicaProgreso");
        if (contador) contador.textContent = `${hechos} de ${total} emparejados`;

        if (hechos === total) {
            const msg = document.getElementById("dinamicaCompleta");
            if (msg) msg.style.display = "block";
            const conclusiones = document.getElementById("dinamicaConclusiones");
            if (conclusiones) conclusiones.style.display = "flex";
            habilitarBotonCompletar(moduloEnPantalla);
        }
    } else {
        f.classList.add("incorrecto");
        g.classList.add("incorrecto");
        setTimeout(() => {
            f.classList.remove("seleccionado", "incorrecto");
            g.classList.remove("seleccionado", "incorrecto");
        }, 550);
    }
}


/* ============================================================
   CLASIFICACIÓN POR NIVEL Y ESPECIALIDAD (Módulo 2)
   ============================================================ */

function barajarVerdaderoFalso() {
    const contenedor = document.querySelector(".vf-lista");
    if (!contenedor) return;

    const filas = Array.from(contenedor.querySelectorAll(".vf-fila"));
    for (let i = filas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filas[i], filas[j]] = [filas[j], filas[i]];
    }
    filas.forEach(fila => contenedor.appendChild(fila));
}

function barajarIncumplimientos() {
    const contenedor = document.querySelector(".incumplimiento-lista");
    if (!contenedor) return;

    const opciones = Array.from(contenedor.querySelectorAll(".incumplimiento-opcion"));
    for (let i = opciones.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
    }
    opciones.forEach(op => contenedor.appendChild(op));
}

function verificarIncumplimientos() {
    const opciones = document.querySelectorAll(".incumplimiento-opcion input[type='checkbox']");
    let correctas = 0;
    let marcadas = 0;

    opciones.forEach(op => {
        const label = op.closest(".incumplimiento-opcion");
        const esperada = op.dataset.correcta === "true";
        label.classList.remove("incumplimiento-ok", "incumplimiento-mal");

        if (op.checked) {
            marcadas++;
            if (esperada) {
                correctas++;
                label.classList.add("incumplimiento-ok");
            } else {
                label.classList.add("incumplimiento-mal");
            }
        } else if (esperada) {
            label.classList.add("incumplimiento-mal");
        }
    });

    const totalCorrectas = Array.from(opciones).filter(op => op.dataset.correcta === "true").length;
    const resultado = document.getElementById("incumplimientosResultado");
    if (resultado) {
        resultado.style.display = "block";
        const acerto = correctas === totalCorrectas && marcadas === totalCorrectas;
        resultado.className = "clasificacion-resultado " + (acerto ? "correcto" : "incorrecto");
        resultado.textContent = acerto
            ? `Identificaste los ${totalCorrectas} incumplimientos correctamente.`
            : `Encontraste ${correctas} de ${totalCorrectas} incumplimientos reales. Revisa las opciones marcadas en rojo.`;
    }

    const retro = document.getElementById("retroalimentacionCaso");
    if (retro) retro.style.display = "block";

    if (correctas === totalCorrectas && marcadas === totalCorrectas) {
        desbloquearActividad22();
    }
}

function desbloquearActividad22() {
    const bloque = document.getElementById("bloqueActividad22");
    const candado = document.getElementById("candadoActividad22");
    const contenido = document.getElementById("contenidoActividad22");
    if (bloque) bloque.classList.remove("bloque-bloqueado");
    if (candado) candado.style.display = "none";
    if (contenido) contenido.style.display = "block";
}

function seleccionarVF(boton) {
    const fila = boton.closest(".vf-fila");
    fila.querySelectorAll(".vf-btn").forEach(b => b.classList.remove("activo"));
    boton.classList.add("activo");
}

function verificarVerdaderoFalso() {
    const filas = document.querySelectorAll(".vf-fila");
    let correctas = 0;
    let contestadas = 0;

    filas.forEach(fila => {
        const btnActivo = fila.querySelector(".vf-btn.activo");
        const exp = fila.querySelector(".vf-explicacion");
        fila.classList.remove("vf-ok", "vf-mal");

        if (!btnActivo) return;
        contestadas++;

        const ok = btnActivo.dataset.valor === fila.dataset.correcta;
        fila.classList.add(ok ? "vf-ok" : "vf-mal");
        if (ok) correctas++;
        if (exp) exp.style.display = "block";
    });

    const total = filas.length;
    const resultado = document.getElementById("vfResultado");
    if (!resultado) return;

    resultado.style.display = "block";
    if (contestadas < total) {
        resultado.className = "clasificacion-resultado aviso";
        resultado.textContent = `Responde las ${total} afirmaciones antes de verificar (llevas ${contestadas}).`;
        return;
    }

    const pct = Math.round((correctas / total) * 100);
    resultado.className = "clasificacion-resultado " + (pct >= 80 ? "correcto" : "incorrecto");
    resultado.textContent = `${correctas} de ${total} correctas (${pct}%).` +
        (pct >= 80 ? " Buen resultado — ya puedes completar el módulo." : " Repasa el numeral indicado en las que fallaste e inténtalo de nuevo.");

    if (pct >= 80) {
        habilitarBotonCompletar(moduloEnPantalla);
        const conclusiones = document.getElementById("modulo2Conclusiones");
        if (conclusiones) conclusiones.style.display = "flex";
    }
}


/* ============================================================
   LLENADO DEL FORMATO Y BITÁCORA OJT (Módulo 3)
   ============================================================ */

function normalizarTexto(v) {
    return (v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const FIRMAS_SVG = {
    evr: '<svg viewBox="0 0 100 36" width="60" height="22"><path d="M6,20 C10,4 16,32 20,16 C24,4 30,4 32,18 C34,28 40,28 44,14 C48,2 54,2 58,16 S68,30 74,12 S86,4 92,20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    evd: '<svg viewBox="0 0 100 36" width="60" height="22"><path d="M6,28 L16,6 L24,32 L34,10 L44,30 L54,8 L64,26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const MODELO_OBSERVACIONES_TEXTO = "15.1 Asistencia a la plática del 10/02/2026 (correo de convocatoria + lista de asistencia + minuta)\n15.2 Lista de verificación firmada el 17/02/2026\n15.3 Lista de verificación firmada el 24/02/2026";

function revisarNivel3(prefijo) {
    const ids = [`${prefijo}-n3-evr-ini`, `${prefijo}-n3-evr-fecha`, `${prefijo}-n3-evd-ini`, `${prefijo}-n3-evd-fecha`];
    const todosLlenos = ids.every(id => {
        const el = document.getElementById(id);
        return el && el.value;
    });

    const rubEvr = document.getElementById(`${prefijo}-n3-evr-rub`);
    const rubEvd = document.getElementById(`${prefijo}-n3-evd-rub`);
    const ambasFirmadas = rubEvr && rubEvr.classList.contains("firmado") && rubEvd && rubEvd.classList.contains("firmado");

    const obs = document.getElementById(`${prefijo}-obs`);
    const hint = document.getElementById(`${prefijo}-obs-hint`);
    if (!obs) return;

    if (todosLlenos && ambasFirmadas) {
        obs.disabled = false;
        if (!obs.value) obs.value = MODELO_OBSERVACIONES_TEXTO;
        obs.placeholder = "";
        if (hint) hint.style.display = "none";
    }
}

function alternarFirma(el) {
    const firmado = el.classList.toggle("firmado");
    el.innerHTML = firmado
        ? FIRMAS_SVG[el.dataset.tipo]
        : '<span class="firma-placeholder">Toca para firmar</span>';

    const m = el.id.match(/^(.+)-n3-(evr|evd)-rub$/);
    if (m) revisarNivel3(m[1]);
}

function verificarFormatoBitacora() {
    const campos = document.querySelectorAll(".campo-calificable");
    let contestados = 0;
    let correctos = 0;

    campos.forEach(campo => {
        const valor = campo.value;
        const correcta = campo.dataset.correcta;
        campo.classList.remove("campo-correcto", "campo-incorrecto");

        if (!valor) return;
        contestados++;

        const ok = campo.type === "date"
            ? valor === correcta
            : normalizarTexto(valor) === normalizarTexto(correcta);

        campo.classList.add(ok ? "campo-correcto" : "campo-incorrecto");
        if (ok) correctos++;
    });

    const total = campos.length;
    const resultado = document.getElementById("formatoResultado");
    if (!resultado) return;

    resultado.style.display = "block";

    if (contestados < total) {
        resultado.className = "clasificacion-resultado aviso";
        resultado.textContent = `Llena los ${total} campos antes de verificar (llevas ${contestados}).`;
        return;
    }

    const pct = Math.round((correctos / total) * 100);
    resultado.className = "clasificacion-resultado " + (pct >= 80 ? "correcto" : "incorrecto");
    if (pct >= 80) {
        habilitarBotonCompletar(moduloEnPantalla);
    }
}

