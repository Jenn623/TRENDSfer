import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';
import { cargarNotificaciones } from './notificaciones-data.js';
import { limpiarInvitacionAmigo, obtenerInvitacionAmigo } from './invitacion-amigo.js';

const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

async function cargarTickets(perfil) {
	const { data: tickets, error } = await supabase
		.from('Tickets')
		.select('id_ticket, id_acreedor, id_deudor, monto, concepto, estado, fecha_creacion')
		.or(`id_acreedor.eq.${perfil.id_usuarios},id_deudor.eq.${perfil.id_usuarios}`)
		.order('fecha_creacion', { ascending: false });

	if (error) throw error;

	const idsRelacionados = [...new Set(tickets.map((ticket) => (
		ticket.id_acreedor === perfil.id_usuarios ? ticket.id_deudor : ticket.id_acreedor
	)))];
	const nombresPorId = new Map();

	if (idsRelacionados.length > 0) {
		const { data: usuarios, error: usuariosError } = await supabase
			.from('Usuarios')
			.select('id_usuarios, nombre, apodo')
			.in('id_usuarios', idsRelacionados);

		if (usuariosError) throw usuariosError;
		usuarios.forEach((usuario) => {
			nombresPorId.set(usuario.id_usuarios, usuario.apodo || usuario.nombre);
		});
	}

	const ticketsPropios = tickets.filter((ticket) => (
		ticket.id_acreedor === perfil.id_usuarios && ticket.estado !== 'Pagada'
	));
	const ticketsPorPagar = tickets.filter((ticket) => (
		ticket.id_deudor === perfil.id_usuarios && ticket.estado !== 'Pagada'
	));
	const totalTeDeben = ticketsPropios.reduce((total, ticket) => total + Number(ticket.monto || 0), 0);
	const totalDebes = ticketsPorPagar.reduce((total, ticket) => total + Number(ticket.monto || 0), 0);

	document.getElementById('deben').textContent = formatoMoneda.format(totalTeDeben);
	document.getElementById('debes').textContent = formatoMoneda.format(totalDebes);

	renderizarLista(
		document.querySelector('[data-tickets-propios]'),
		ticketsPropios,
		(ticket) => ticket.id_deudor,
		nombresPorId,
		'Aún no tienes personas que te deban.',
		'deudor-persona'
	);
	renderizarLista(
		document.querySelector('[data-tickets-debo]'),
		ticketsPorPagar,
		(ticket) => ticket.id_acreedor,
		nombresPorId,
		'Aún no tienes tickets por pagar.',
		'deudas-persona',
		(ticket) => {
			if (ticket.estado === 'Pendiente') return './cuenta.html?seccion=notificaciones';
			if (ticket.estado === 'Aceptada') {
				return `./PagarDeuda.html?id=${encodeURIComponent(ticket.id_ticket)}`;
			}
			return null;
		}
	);
	renderizarPagosAceptados(ticketsPorPagar, nombresPorId, perfil);
}

function renderizarPagosAceptados(tickets, nombresPorId, perfil) {
	const contenedor = document.querySelector('[data-pagos-aceptados]');
	contenedor.replaceChildren();

	const aceptados = tickets.filter((ticket) => ticket.estado === 'Aceptada');
	if (aceptados.length === 0) {
		const mensaje = document.createElement('p');
		mensaje.className = 'payments-empty';
		mensaje.textContent = 'No tienes deudas aceptadas pendientes de pago.';
		contenedor.append(mensaje);
		return;
	}

	aceptados.forEach((ticket) => {
		const tarjeta = document.createElement('article');
		const qr = document.createElement('img');
		const monto = document.createElement('p');
		const concepto = document.createElement('p');
		const confirmarPago = document.createElement('button');
		const indicacion = document.createElement('p');

		tarjeta.className = 'payment-card';
		qr.src = './img/qr-code.png';
		qr.alt = 'Código QR de CoDi';
		monto.className = 'payment-amount';
		monto.textContent = formatoMoneda.format(Number(ticket.monto) || 0);
		concepto.className = 'payment-description';
		concepto.textContent = `Concepto: ${ticket.concepto?.trim() || 'Sin concepto'} · ${nombresPorId.get(ticket.id_acreedor) || 'Usuario'}`;
		confirmarPago.className = 'payment-button';
		confirmarPago.type = 'button';
		confirmarPago.textContent = 'Ya pagué';
		confirmarPago.addEventListener('click', () => reportarPago(ticket, perfil, confirmarPago));
		indicacion.className = 'payment-hint';
		indicacion.textContent = 'Escanéalo con tu app bancaria';
		tarjeta.append(qr, monto, concepto, confirmarPago, indicacion);
		contenedor.append(tarjeta);
	});
}

async function reportarPago(ticket, perfil, boton) {
	if (boton.disabled) return;

	boton.disabled = true;
	boton.textContent = 'Registrando...';
	let pagoRegistrado = false;
	try {
		const { data, error } = await supabase
			.from('Tickets')
			.update({ estado: 'Pagada' })
			.eq('id_ticket', ticket.id_ticket)
			.eq('id_deudor', perfil.id_usuarios)
			.eq('estado', 'Aceptada')
			.select('id_ticket')
			.maybeSingle();

		if (error) throw error;
		if (!data) throw new Error('El estado de esta deuda cambió. Actualiza la página e inténtalo de nuevo.');
		pagoRegistrado = true;

		await Promise.all([
			cargarTickets(perfil),
			cargarNotificaciones(
				document.querySelector('[data-notificaciones]'),
				perfil.id_usuarios
			)
		]);
	} catch (error) {
		console.error('No se pudo registrar el pago:', error);
		if (pagoRegistrado) {
			boton.textContent = 'Pago reportado';
			alert('El pago quedó reportado, pero no se pudo actualizar toda la página. Recárgala para ver los cambios.');
			return;
		}
		alert('No se pudo registrar el pago: ' + error.message);
		boton.disabled = false;
		boton.textContent = 'Ya pagué';
	}
}

function renderizarLista(contenedor, tickets, obtenerIdUsuario, nombresPorId, mensajeVacio, claseFila, obtenerEnlace = () => null) {
	contenedor.replaceChildren();

	if (tickets.length === 0) {
		const mensaje = document.createElement('p');
		mensaje.className = 'ticket-list-empty';
		mensaje.textContent = mensajeVacio;
		contenedor.replaceChildren(mensaje);
		return;
	}

	tickets.forEach((ticket) => {
		const idUsuario = obtenerIdUsuario(ticket);
		const enlace = obtenerEnlace(ticket);
		const fila = document.createElement(enlace ? 'a' : 'div');
		const detalle = document.createElement('p');
		const monto = document.createElement('p');

		fila.className = claseFila;
		if (enlace) {
			fila.classList.add('deuda-accion-fila');
			fila.href = enlace;
			fila.setAttribute('aria-label', `${ticket.estado === 'Pendiente' ? 'Aceptar' : 'Pagar'} deuda: ${ticket.concepto || 'Sin concepto'}`);
		}
		detalle.className = 'nombre';
		const textoDetalle = `${nombresPorId.get(idUsuario) || 'Usuario'} · ${ticket.concepto || 'Sin concepto'}`;
		detalle.textContent = textoDetalle;
		monto.className = 'monto';
		monto.textContent = formatoMoneda.format(Number(ticket.monto));
		fila.append(detalle, monto);
		if (enlace) {
			const accion = document.createElement('span');
			accion.className = 'deuda-accion-etiqueta';
			accion.setAttribute('aria-hidden', 'true');
			accion.textContent = ticket.estado === 'Pendiente' ? 'Aceptar ›' : 'Pagar ›';
			fila.append(accion);
		}
		contenedor.append(fila);
	});
}

function actualizarUrlSinInvitacion() {
	const url = new URL(window.location.href);
	url.searchParams.delete('invitar');
	window.history.replaceState({}, '', url);
}

async function procesarInvitacionAmigo(idUsuarioActual) {
	const idInvitador = obtenerInvitacionAmigo();
	if (!idInvitador) return;

	actualizarUrlSinInvitacion();
	const dialogo = document.querySelector('[data-amigo-invitacion]');
	const titulo = dialogo.querySelector('[data-amigo-invitacion-titulo]');
	const mensaje = dialogo.querySelector('[data-amigo-invitacion-mensaje]');
	const aceptar = dialogo.querySelector('[data-amigo-invitacion-aceptar]');
	const rechazar = dialogo.querySelector('[data-amigo-invitacion-rechazar]');
	const luego = dialogo.querySelector('[data-amigo-invitacion-luego]');

	const cerrar = (accion) => {
		if (dialogo.open) dialogo.close();
		limpiarInvitacionAmigo();
		aceptar.hidden = false;
		rechazar.hidden = false;
		luego.hidden = false;
		if (accion === 'pendiente') {
			alert('Guardamos la solicitud. Puedes aceptarla o rechazarla después desde Amigos > Solicitudes.');
		} else if (accion === 'denegado') {
			alert('Rechazaste la invitación.');
		} else if (accion === 'aceptado') {
			alert('Ahora son amigos.');
		}
	};

	const mostrarAviso = (texto) => {
		titulo.textContent = 'Invitación de amistad';
		mensaje.textContent = texto;
		aceptar.hidden = true;
		rechazar.hidden = true;
		luego.textContent = 'Cerrar';
		luego.onclick = () => {
			dialogo.close();
			limpiarInvitacionAmigo();
		};
		dialogo.showModal();
	};

	try {
		if (idInvitador === idUsuarioActual) {
			limpiarInvitacionAmigo();
			return;
		}

		const [{ data: perfiles, error: perfilError }, { data: estadoInvitacion, error: estadoError }] = await Promise.all([
			supabase.rpc('obtener_perfil_invitacion_amigo', { p_token: idInvitador }),
			supabase.rpc('resolver_invitacion_amigo', { p_token: idInvitador, p_accion: 'consultar' })
		]);

		if (perfilError) throw perfilError;
		if (estadoError) throw estadoError;
		const perfilInvitador = perfiles?.[0];
		if (!perfilInvitador) {
			mostrarAviso('No encontramos el perfil de la invitación. Pide que te compartan un QR actualizado.');
			return;
		}

		if (estadoInvitacion === 'aceptado') {
			limpiarInvitacionAmigo();
			mostrarAviso(`Tú y ${perfilInvitador.apodo || perfilInvitador.nombre || 'este usuario'} ya son amigos.`);
			return;
		}
		if (estadoInvitacion === 'solicitud_enviada') {
			mostrarAviso('Ya enviaste una solicitud a este usuario. Espera a que la acepte.');
			return;
		}

		const nombreInvitador = perfilInvitador.apodo?.trim()
			|| perfilInvitador.nombre?.trim()
			|| 'Un usuario';
		titulo.textContent = 'Invitación de amistad';
		aceptar.hidden = false;
		rechazar.hidden = false;
		luego.hidden = false;
		luego.textContent = 'Luego';
		mensaje.textContent = estadoInvitacion === 'pendiente'
			? `${nombreInvitador} quiere ser tu amigo. Puedes decidir ahora o después desde Amigos > Solicitudes.`
			: `${nombreInvitador} quiere ser tu amigo. ¿Qué quieres hacer?`;
		dialogo.showModal();

		const resolver = async (accion) => {
			[aceptar, rechazar, luego].forEach((boton) => {
				boton.disabled = true;
			});
			try {
				const { data, error } = await supabase.rpc('resolver_invitacion_amigo', {
					p_token: idInvitador,
					p_accion: accion
				});
				if (error) throw error;
				if (data !== accion) throw new Error('No se pudo actualizar la invitación. Vuelve a intentarlo.');
				cerrar(accion);
			} catch (error) {
				console.error('No se pudo resolver la invitación de amistad:', error);
				alert('No se pudo actualizar la invitación: ' + error.message);
			} finally {
				[aceptar, rechazar, luego].forEach((boton) => {
					boton.disabled = false;
				});
			}
		};
		aceptar.onclick = () => resolver('aceptado');
		rechazar.onclick = () => resolver('denegado');
		luego.onclick = () => resolver('pendiente');
		dialogo.addEventListener('cancel', (evento) => {
			evento.preventDefault();
			resolver('pendiente');
		}, { once: true });
	} catch (error) {
		console.error('No se pudo procesar la invitación de amistad:', error);
		mostrarAviso('No se pudo validar la invitación: ' + error.message);
	}
}

async function iniciarPagina() {
	try {
		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('index.html');
			return;
		}

		const nombrePerfil = sesion.perfil.apodo || sesion.perfil.nombre || sesion.authUser.email || 'Usuario';
		const inicial = nombrePerfil.trim().charAt(0).toUpperCase() || 'U';
		document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
			elemento.textContent = `Hola, ${nombrePerfil}`;
		});
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = inicial;
		});

		const contenedorNotificaciones = document.querySelector('[data-notificaciones]');
		await Promise.all([
			cargarTickets(sesion.perfil),
			cargarNotificaciones(contenedorNotificaciones, sesion.perfil.id_usuarios)
		]);
		await procesarInvitacionAmigo(sesion.perfil.id_usuarios);
		const canal = supabase
			.channel(`tickets-${sesion.perfil.id_usuarios}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'Tickets' }, () => {
				cargarTickets(sesion.perfil).catch((error) => console.error('Error actualizando tickets:', error));
			})
			.subscribe();
		const canalNotificaciones = supabase
			.channel(`notificaciones-principal-${sesion.perfil.id_usuarios}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'Notificaciones' }, () => {
				cargarNotificaciones(contenedorNotificaciones, sesion.perfil.id_usuarios)
					.catch((error) => console.error('Error actualizando notificaciones:', error));
			})
			.subscribe();

		window.addEventListener('beforeunload', () => {
			supabase.removeChannel(canal);
			supabase.removeChannel(canalNotificaciones);
		}, { once: true });
	} catch (error) {
		console.error('No se pudo cargar la página principal:', error);
		alert('No se pudo cargar la información: ' + error.message);
	}
}

iniciarPagina();
