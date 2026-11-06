import { supabase } from './supabase.js';

const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoTiempo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function tiempoRelativo(fecha) {
	const milisegundos = Date.parse(fecha);
	if (!Number.isFinite(milisegundos)) return '';

	const diferencia = milisegundos - Date.now();
	const unidades = [
		['day', 86400000],
		['hour', 3600000],
		['minute', 60000]
	];
	const [unidad, duracion] = unidades.find(([, valor]) => Math.abs(diferencia) >= valor) || ['second', 1000];
	return formatoTiempo.format(Math.round(diferencia / duracion), unidad);
}

export async function cargarNotificaciones(contenedor, idUsuario) {
	if (!contenedor) throw new Error('No se encontró el apartado de notificaciones.');

	const [{ data: deudas, error: deudasError }, { data: pagos, error: pagosError }] = await Promise.all([
		supabase
			.from('Tickets')
			.select('id_ticket, id_acreedor, monto, concepto, estado, fecha_creacion')
			.eq('id_deudor', idUsuario)
			.in('estado', ['Pendiente', 'Aceptada'])
			.order('fecha_creacion', { ascending: false }),
		supabase
			.from('Tickets')
			.select('id_ticket, id_deudor, id_acreedor, monto, concepto, estado, fecha_creacion')
			.eq('id_acreedor', idUsuario)
			.eq('estado', 'Pagada')
			.order('fecha_creacion', { ascending: false })
	]);

	if (deudasError) throw deudasError;
	if (pagosError) throw pagosError;
	const notificaciones = [
		...deudas.map((ticket) => ({ ...ticket, tipo: 'deuda' })),
		...pagos.map((ticket) => ({ ...ticket, tipo: 'pago' }))
	].sort((a, b) => Date.parse(b.fecha_creacion) - Date.parse(a.fecha_creacion));

	const idsUsuariosRelacionados = [...new Set(notificaciones.map((ticket) => (
		ticket.tipo === 'pago' ? ticket.id_deudor : ticket.id_acreedor
	)))];
	const nombresPorId = new Map();

	if (idsUsuariosRelacionados.length > 0) {
		const { data: usuarios, error: usuariosError } = await supabase
			.from('Usuarios')
			.select('id_usuarios, nombre, apodo')
			.in('id_usuarios', idsUsuariosRelacionados);

		if (usuariosError) throw usuariosError;
		usuarios.forEach((usuario) => {
			nombresPorId.set(usuario.id_usuarios, usuario.apodo?.trim() || usuario.nombre?.trim() || 'Usuario');
		});
	}

	contenedor.replaceChildren();
	if (notificaciones.length === 0) {
		const vacio = document.createElement('p');
		vacio.textContent = 'No tienes nuevas notificaciones.';
		contenedor.append(vacio);
		return;
	}

	notificaciones.forEach((ticket, indice) => {
		const notificacion = document.createElement('div');
		const titulo = document.createElement('div');
		const mensaje = document.createElement('h3');
		const enlace = document.createElement('a');
		const descripcion = document.createElement('div');
		const detalle = document.createElement('p');

		notificacion.className = 'notificacion-container';
		titulo.className = 'notificacion-title';
		const esPagoRecibido = ticket.tipo === 'pago';
		const deudaAceptada = ticket.estado === 'Aceptada';
		const paginaDestino = esPagoRecibido
			? 'principal.html'
			: deudaAceptada ? 'principal.html' : 'AceptarDeuda.html';
		enlace.href = `./${paginaDestino}${esPagoRecibido ? '' : `?id=${encodeURIComponent(ticket.id_ticket)}`}`;
		enlace.className = 'notificacion-link';
		enlace.textContent = esPagoRecibido
			? `${nombresPorId.get(ticket.id_deudor) || 'El deudor'} te reportó el pago de una deuda`
			: deudaAceptada
				? 'Deuda aceptada · pendiente de pago'
			: `${nombresPorId.get(ticket.id_acreedor) || 'Usuario'} te creó una deuda`;
		mensaje.append(enlace);
		titulo.append(mensaje);
		descripcion.className = 'notificacion-description';
		const concepto = ticket.concepto?.trim() || 'Sin concepto';
		const monto = formatoMoneda.format(Number(ticket.monto) || 0);
		const relativo = esPagoRecibido ? '' : tiempoRelativo(ticket.fecha_creacion);
		detalle.textContent = [concepto, monto, relativo].filter(Boolean).join(' · ');
		descripcion.append(detalle);
		notificacion.append(titulo, descripcion);
		contenedor.append(notificacion);

		if (indice < notificaciones.length - 1) {
			const divisor = document.createElement('div');
			divisor.className = 'divisor';
			contenedor.append(divisor);
		}
	});
}
