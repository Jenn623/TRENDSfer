import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

const descripcion = document.querySelector('[data-deuda-descripcion]');
const botonAceptar = document.querySelector('[data-aceptar-deuda]');
const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
let ticketActual;
let usuarioActual;

async function cargarDeuda() {
	try {
		const idTicket = new URLSearchParams(window.location.search).get('id');
		if (!idTicket) throw new Error('Falta el identificador de la deuda.');

		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('./index.html');
			return;
		}

		const { data: ticket, error } = await supabase
			.from('Tickets')
			.select('id_ticket, id_acreedor, id_deudor, monto, concepto, estado')
			.eq('id_ticket', idTicket)
			.eq('id_deudor', sesion.perfil.id_usuarios)
			.maybeSingle();

		if (error) throw error;
		if (!ticket) {
			throw new Error('La deuda no existe o no está asociada a tu cuenta.');
		}
		ticketActual = ticket;
		usuarioActual = sesion.perfil.id_usuarios;

		const { data: acreedor, error: acreedorError } = await supabase
			.from('Usuarios')
			.select('nombre, apodo')
			.eq('id_usuarios', ticket.id_acreedor)
			.maybeSingle();

		if (acreedorError) throw acreedorError;
		const nombreAcreedor = acreedor?.apodo?.trim()
			|| acreedor?.nombre?.trim()
			|| 'Usuario';
		const monto = formatoMoneda.format(Number(ticket.monto) || 0);
		const concepto = ticket.concepto?.trim();
		descripcion.replaceChildren();
		descripcion.append(
			document.createTextNode(`Le debes a ${nombreAcreedor} `)
		);
		const cantidad = document.createElement('strong');
		cantidad.textContent = monto;
		descripcion.append(document.createTextNode(' por '), cantidad);
		if (concepto) {
			descripcion.append(document.createTextNode(` · ${concepto}`));
		}

		if (ticket.estado === 'Aceptada') {
			botonAceptar.textContent = 'Deuda aceptada';
			botonAceptar.disabled = true;
		} else if (ticket.estado !== 'Pendiente') {
			botonAceptar.textContent = `Estado: ${ticket.estado || 'No disponible'}`;
			botonAceptar.disabled = true;
		} else {
			botonAceptar.textContent = 'Aceptar deuda';
			botonAceptar.disabled = false;
		}
	} catch (error) {
		console.error('No se pudo cargar la deuda:', error);
		descripcion.textContent = error.message || 'No se pudo cargar la deuda.';
		botonAceptar.textContent = 'No disponible';
		botonAceptar.disabled = true;
	}
}

botonAceptar.addEventListener('click', async () => {
	if (!ticketActual || !usuarioActual || botonAceptar.disabled) return;

	botonAceptar.disabled = true;
	botonAceptar.textContent = 'Aceptando...';
	try {
		const { data, error } = await supabase
			.from('Tickets')
			.update({ estado: 'Aceptada' })
			.eq('id_ticket', ticketActual.id_ticket)
			.eq('id_deudor', usuarioActual)
			.eq('estado', 'Pendiente')
			.select('id_ticket')
			.maybeSingle();

		if (error) throw error;
		if (!data) throw new Error('La deuda ya no está pendiente. Actualiza la página para ver su estado.');

		window.location.replace('./principal.html');
	} catch (error) {
		console.error('No se pudo aceptar la deuda:', error);
		alert('No se pudo aceptar la deuda: ' + error.message);
		botonAceptar.disabled = false;
		botonAceptar.textContent = 'Aceptar deuda';
	}
});

cargarDeuda();
