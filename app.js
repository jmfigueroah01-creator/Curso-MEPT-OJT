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

function abrirModulo(numero) {
    if (!estaDesbloqueado(numero)) {
        alert("Primero debes completar el módulo " + (numero - 1) + ".");
        return;
    }

    const m = MODULOS[numero];
    const contenido = document.getElementById("contenidoModulo");
    const yaCompleto = !!progreso["modulo" + numero];

    const opcionesHtml = m.checkpoint.opciones.map(op => `
        <label class="checkpoint-opcion">
            <input type="radio" name="checkpoint${numero}" value="${op.id}">
            ${op.texto}
        </label>
    `).join("");

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

            <p class="contexto-modulo">${m.contexto}</p>

            ${m.microbloques_html}

            <div class="checkpoint-box" id="checkpointBox${numero}">
                <div class="checkpoint-titulo">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 13 11 15.5 15.5 10.5"/><rect x="5" y="4" width="14" height="17" rx="1.5"/></svg>
                    Punto de chequeo
                </div>
                <p class="checkpoint-pregunta">${m.checkpoint.pregunta}</p>
                <div class="checkpoint-opciones">${opcionesHtml}</div>
                <div class="checkpoint-feedback" id="checkpointFeedback${numero}"></div>
                <button class="btn-secundario" onclick="verificarCheckpoint(${numero})">Verificar respuesta</button>
            </div>

            <div class="checklist-modulo">
                <p class="checklist-modulo-titulo">Checklist de referencia</p>
                <ul>${m.checklist.map(item => `<li>${item}</li>`).join("")}</ul>
            </div>

            <button class="btn-principal" style="width:auto;" id="btnCompletarModulo${numero}" onclick="completarModulo(${numero})" ${yaCompleto ? "" : "disabled"}>
                ${yaCompleto ? "Módulo completado ✓ (repasar no reinicia tu progreso)" : "Responde el checkpoint para habilitar este botón"}
            </button>
        </div>
    `;

    contenido.scrollIntoView({ behavior: "smooth" });
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
        ? `Buen resultado en la práctica: ${porcentaje}%. Ya puedes continuar a la evaluación oficial en Microsoft Forms.`
        : `Resultado de práctica: ${porcentaje}%. Revise nuevamente los contenidos antes de ir a la evaluación oficial.`;
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

    const etiquetas = ["Bienvenida", "Propósito", "Tu ritmo", "Objetivo", "Estructura", "Antes de iniciar"];
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
