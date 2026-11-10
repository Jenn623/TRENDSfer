import { supabase } from './supabase.js';

const formatoTiempo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

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

	let { data: notificaciones, error } = await supabase
		.from('Notificaciones')
		.select('id_notificacion, titulo_notificacion, mensaje, estado, fecha_creacion, id_ticket, id_actor, concepto_ticket, monto_ticket')
		.eq('id_usuario', idUsuario)
		.order('fecha_creacion', { ascending: false });

	const faltaColumnaOpcional = error
		&& (['42703', 'PGRST204'].includes(error.code) || /column .* does not exist|could not find .* column/i.test(error.message || ''));
	if (faltaColumnaOpcional) {
		console.warn('Faltan columnas de la migración de notificaciones; se cargarán usando el esquema básico.', error);
		({ data: notificaciones, error } = await supabase
			.from('Notificaciones')
			.select('id_notificacion, titulo_notificacion, mensaje, estado, fecha_creacion')
			.eq('id_usuario', idUsuario)
			.order('fecha_creacion', { ascending: false }));
	}

	if (error) throw error;

	const idsActores = [...new Set(notificaciones.map((registro) => registro.id_actor).filter(Boolean))];
	const nombresPorId = new Map();
	if (idsActores.length > 0) {
		const { data: usuarios, error: usuariosError } = await supabase
			.from('Usuarios')
			.select('id_usuarios, nombre, apodo')
			.in('id_usuarios', idsActores);

		if (usuariosError) throw usuariosError;
		usuarios.forEach((usuario) => {
			nombresPorId.set(
				usuario.id_usuarios,
				usuario.apodo?.trim() || usuario.nombre?.trim() || 'Usuario'
			);
		});
	}

	contenedor.replaceChildren();
	if (notificaciones.length === 0) {
		const vacio = document.createElement('p');
		vacio.textContent = 'No tienes nuevas notificaciones.';
		contenedor.append(vacio);
		return;
	}

	notificaciones.forEach((registro, indice) => {
		const notificacion = document.createElement('div');
		const titulo = document.createElement('div');
		const mensaje = document.createElement('h3');
		const enlace = document.createElement('a');
		const descripcion = document.createElement('div');
		const detalle = document.createElement('p');
		const noLeida = registro.estado === false || registro.estado === 'false' || registro.estado === 0;
		const nombreActor = nombresPorId.get(registro.id_actor) || 'Usuario';

		notificacion.className = 'notificacion-container';
		notificacion.classList.toggle('notificacion-no-leida', noLeida);
		titulo.className = 'notificacion-title';
		enlace.href = registro.titulo_notificacion === 'Nueva deuda' && registro.id_ticket
			? `./AceptarDeuda.html?id=${encodeURIComponent(registro.id_ticket)}`
			: './principal.html';
		enlace.className = 'notificacion-link';
		enlace.textContent = registro.titulo_notificacion === 'Nueva deuda'
			? `${nombreActor} te creó una deuda`
			: registro.titulo_notificacion === 'Deuda aceptada'
				? 'Deuda aceptada · pendiente de pago'
				: registro.titulo_notificacion === 'Pago reportado'
					? `${nombreActor} te reportó el pago de una deuda`
					: registro.titulo_notificacion || 'Notificación';
		enlace.addEventListener('click', async (evento) => {
			if (!noLeida) return;

			evento.preventDefault();
			const { error: actualizarError } = await supabase
				.from('Notificaciones')
				.update({ estado: true })
				.eq('id_notificacion', registro.id_notificacion)
				.eq('id_usuario', idUsuario);

			if (actualizarError) {
				console.error('No se pudo marcar la notificación como leída:', actualizarError);
				alert('No se pudo actualizar la notificación: ' + actualizarError.message);
				return;
			}

			window.location.assign(enlace.href);
		});
		mensaje.append(enlace);
		if (noLeida) {
			const indicador = document.createElement('span');
			indicador.className = 'notificacion-circle';
			indicador.setAttribute('aria-label', 'No leída');
			titulo.append(indicador);
		}
		titulo.append(mensaje);
		descripcion.className = 'notificacion-description';
		const monto = Number(registro.monto_ticket);
		const concepto = registro.concepto_ticket?.trim();
		const resumen = [
			concepto,
			registro.monto_ticket != null && Number.isFinite(monto)
				? formatoMoneda.format(monto)
				: registro.mensaje
		].filter(Boolean).join(' · ');
		detalle.textContent = [resumen, tiempoRelativo(registro.fecha_creacion)]
			.filter(Boolean)
			.join(' · ');
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
