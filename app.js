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

// URL del flujo de Power Automate que llama a la API de IA para el asistente MEPT.
// Debe recibir POST { pregunta, historial } y responder { respuesta }. Ver especificación al final de este archivo.
const URL_ASISTENTE_IA = "";

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

            const correoMostrado = document.getElementById("correoMostrado");
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

    return `
        <div class="bloque">
        <div class="bloque-titulo"><span class="bloque-num">P</span>Presentación del módulo</div>
        <div class="presentacion-embebida">
            <iframe src="${urlVisor}" frameborder="0" allowfullscreen></iframe>
        </div>
        <div class="presentacion-acciones">
            <a class="btn-secundario" href="${urlVisor}" target="_blank" rel="noopener">Ver en pantalla completa</a>
            <a class="btn-secundario" href="${urlArchivo}" download>Descargar .pptx</a>
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
                <span>Al terminar podrás</span>
                <p>${m.objetivo_desempeno}</p>
            </div>

            <p class="temario-eyebrow">Temario de este módulo</p>
            <ul class="temario-lista">
                ${m.temario.map((tema, i) => `<li><span class="temario-num">${i + 1}</span>${tema}</li>`).join("")}
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

                        <div class="checklist-modulo">
                            <p class="checklist-modulo-titulo">Resumen</p>
                            <ul>${m.checklist.map(item => `<li>${item}</li>`).join("")}</ul>
                        </div>
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
    barajarCasosClasificacion();
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
const TOTAL_PASOS = 6;

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

    const etiquetas = ["Bienvenida", "Objetivos", "Contenido", "Recursos", "Puntos clave", "Evaluación"];
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

function seleccionarNivel(boton) {
    const fila = boton.closest(".caso-fila");
    fila.querySelectorAll(".nivel-pill").forEach(p => p.classList.remove("activo"));
    boton.classList.add("activo");
    actualizarContadorClasificacion();
}

function actualizarContadorClasificacion() {
    const filas = document.querySelectorAll(".caso-fila");
    const contador = document.getElementById("clasificacionContador");
    if (!contador) return;

    const completados = Array.from(filas).filter(f =>
        f.querySelector(".nivel-pill.activo") && f.querySelector(".caso-especialidad").value
    ).length;

    contador.textContent = `${completados} de ${filas.length} completados`;
}

function barajarCasosClasificacion() {
    const contenedor = document.querySelector(".clasificacion-lista");
    if (!contenedor) return;

    const filas = Array.from(contenedor.querySelectorAll(".caso-fila"));
    for (let i = filas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filas[i], filas[j]] = [filas[j], filas[i]];
    }
    filas.forEach(f => contenedor.appendChild(f));
}

function verificarClasificacion() {
    const filas = document.querySelectorAll(".caso-fila");
    let correctas = 0;

    filas.forEach(fila => {
        const nivelPill = fila.querySelector(".nivel-pill.activo");
        const espSel = fila.querySelector(".caso-especialidad");
        const nivelVal = nivelPill ? nivelPill.dataset.valor : "";
        const ok = nivelVal === fila.dataset.nivel && espSel.value === fila.dataset.especialidad;

        fila.classList.remove("caso-correcto", "caso-incorrecto");
        if (!nivelVal || !espSel.value) return;
        fila.classList.add(ok ? "caso-correcto" : "caso-incorrecto");
        if (ok) correctas++;
    });

    const total = filas.length;
    const contestadas = Array.from(filas).filter(f => f.querySelector(".nivel-pill.activo") && f.querySelector(".caso-especialidad").value).length;
    const resultado = document.getElementById("clasificacionResultado");
    if (!resultado) return;

    resultado.style.display = "block";
    if (contestadas < total) {
        resultado.className = "clasificacion-resultado aviso";
        resultado.textContent = `Responde los ${total} casos antes de verificar (llevas ${contestadas}).`;
        return;
    }

    const pct = Math.round((correctas / total) * 100);
    resultado.className = "clasificacion-resultado " + (pct >= 80 ? "correcto" : "incorrecto");
    resultado.textContent = `${correctas} de ${total} correctos (${pct}%).` +
        (pct >= 80 ? " Buen resultado — ya puedes completar el módulo." : " Revisa los casos marcados en rojo e inténtalo de nuevo.");

    if (pct >= 80) {
        habilitarBotonCompletar(moduloEnPantalla);
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

function alternarFirma(el) {
    const firmado = el.classList.toggle("firmado");
    el.innerHTML = firmado
        ? FIRMAS_SVG[el.dataset.tipo]
        : '<span class="firma-placeholder">Toca para firmar</span>';
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
        const modelo = document.getElementById("modeloObservaciones");
        if (modelo) modelo.classList.add("visible");
    }
}


/* ============================================================
   ASISTENTE DE IA (chat de dudas sobre el MEPT)
   ============================================================
   Requiere un flujo de Power Automate en URL_ASISTENTE_IA que:
   1) Reciba POST con JSON { pregunta: string, historial: [{rol, texto}, ...] }
   2) Llame a la API de IA de su elección con un system prompt basado en el MEPT
   3) Responda JSON { respuesta: string }
   Ver especificación completa al final de este archivo.
   ============================================================ */

let historialAsistente = [];

function alternarAsistente() {
    const panel = document.getElementById("asistentePanel");
    if (!panel) return;
    panel.classList.toggle("visible");
    if (panel.classList.contains("visible")) {
        const input = document.getElementById("asistenteInput");
        if (input) input.focus();
    }
}

function agregarMensajeAsistente(texto, rol) {
    const contenedor = document.getElementById("asistenteMensajes");
    if (!contenedor) return;
    const div = document.createElement("div");
    div.className = "asistente-mensaje " + (rol === "usuario" ? "asistente-usuario" : rol === "error" ? "asistente-bot asistente-error" : "asistente-bot");
    div.textContent = texto;
    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
}

function enviarPreguntaAsistente() {
    const input = document.getElementById("asistenteInput");
    const boton = document.querySelector(".asistente-enviar");
    if (!input) return;

    const pregunta = input.value.trim();
    if (!pregunta) return;

    if (!URL_ASISTENTE_IA) {
        agregarMensajeAsistente(pregunta, "usuario");
        agregarMensajeAsistente("El asistente aún no está conectado. Falta configurar URL_ASISTENTE_IA en app.js con el flujo de Power Automate correspondiente.", "error");
        input.value = "";
        return;
    }

    agregarMensajeAsistente(pregunta, "usuario");
    historialAsistente.push({ rol: "usuario", texto: pregunta });
    input.value = "";
    input.style.height = "auto";

    if (boton) boton.disabled = true;
    const contenedor = document.getElementById("asistenteMensajes");
    const indicador = document.createElement("div");
    indicador.className = "asistente-escribiendo";
    indicador.id = "asistenteEscribiendo";
    indicador.innerHTML = "<span></span><span></span><span></span>";
    contenedor.appendChild(indicador);
    contenedor.scrollTop = contenedor.scrollHeight;

    fetch(URL_ASISTENTE_IA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: pregunta, historial: historialAsistente })
    })
        .then(resp => resp.json())
        .then(data => {
            const escribiendo = document.getElementById("asistenteEscribiendo");
            if (escribiendo) escribiendo.remove();
            const respuesta = (data && data.respuesta) ? data.respuesta : "No obtuve respuesta. Intenta de nuevo o contacta a tu Instructor Coordinador OJT.";
            agregarMensajeAsistente(respuesta, "bot");
            historialAsistente.push({ rol: "asistente", texto: respuesta });
        })
        .catch(() => {
            const escribiendo = document.getElementById("asistenteEscribiendo");
            if (escribiendo) escribiendo.remove();
            agregarMensajeAsistente("No fue posible conectar con el asistente. Verifica tu conexión o contacta a tu Instructor Coordinador OJT.", "error");
        })
        .finally(() => {
            if (boton) boton.disabled = false;
        });
}
