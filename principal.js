import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

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

	const ticketsPropios = tickets.filter((ticket) => ticket.id_acreedor === perfil.id_usuarios);
	const ticketsPorPagar = tickets.filter((ticket) => ticket.id_deudor === perfil.id_usuarios);
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
		'deudas-persona'
	);
}

function renderizarLista(contenedor, tickets, obtenerIdUsuario, nombresPorId, mensajeVacio, claseFila) {
	contenedor.replaceChildren();

	if (tickets.length === 0) {
		contenedor.textContent = mensajeVacio;
		return;
	}

	tickets.forEach((ticket) => {
		const idUsuario = obtenerIdUsuario(ticket);
		const fila = document.createElement('div');
		const detalle = document.createElement('p');
		const monto = document.createElement('p');

		fila.className = claseFila;
		detalle.className = 'nombre';
		detalle.textContent = `${nombresPorId.get(idUsuario) || 'Usuario'} · ${ticket.concepto}`;
		monto.className = 'monto';
		monto.textContent = formatoMoneda.format(Number(ticket.monto));
		fila.append(detalle, monto);
		contenedor.append(fila);
	});
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
			elemento.textContent = nombrePerfil;
		});
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = inicial;
		});

		await cargarTickets(sesion.perfil);
		const canal = supabase
			.channel(`tickets-${sesion.perfil.id_usuarios}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'Tickets' }, () => {
				cargarTickets(sesion.perfil).catch((error) => console.error('Error actualizando tickets:', error));
			})
			.subscribe();

		window.addEventListener('beforeunload', () => supabase.removeChannel(canal), { once: true });
	} catch (error) {
		console.error('No se pudo cargar la página principal:', error);
		alert('No se pudo cargar la información: ' + error.message);
	}
}

iniciarPagina();
