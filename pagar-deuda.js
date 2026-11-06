import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

const montoElemento = document.querySelector('[data-pago-monto]');
const conceptoElemento = document.querySelector('[data-pago-concepto]');
const botonPague = document.querySelector('[data-confirmar-pago]');
const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
let ticketActual;
let usuarioActual;

async function cargarPago() {
	try {
		const idTicket = new URLSearchParams(window.location.search).get('id');
		if (!idTicket) throw new Error('Falta el identificador de la deuda.');

		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('./index.html');
			return;
		}

		const nombre = sesion.perfil.apodo?.trim() || sesion.perfil.nombre?.trim() || 'Usuario';
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = nombre.charAt(0).toUpperCase() || 'U';
		});

		const { data: ticket, error } = await supabase
			.from('Tickets')
			.select('id_ticket, id_deudor, monto, concepto, estado')
			.eq('id_ticket', idTicket)
			.eq('id_deudor', sesion.perfil.id_usuarios)
			.eq('estado', 'Aceptada')
			.maybeSingle();

		if (error) throw error;
		if (!ticket) throw new Error('La deuda no existe, no te pertenece o todavía no ha sido aceptada.');

		ticketActual = ticket;
		usuarioActual = sesion.perfil.id_usuarios;
		montoElemento.textContent = formatoMoneda.format(Number(ticket.monto) || 0);
		conceptoElemento.textContent = `Concepto: ${ticket.concepto?.trim() || 'Sin concepto'}`;
		botonPague.disabled = false;
	} catch (error) {
		console.error('No se pudo cargar el pago:', error);
		montoElemento.textContent = error.message || 'No se pudo cargar el pago.';
		conceptoElemento.textContent = '';
		botonPague.disabled = true;
	}
}

botonPague.addEventListener('click', async () => {
	if (!ticketActual || !usuarioActual || botonPague.disabled) return;

	botonPague.disabled = true;
	botonPague.textContent = 'Registrando...';
	try {
		const { data, error } = await supabase
			.from('Tickets')
			.update({ estado: 'Pagada' })
			.eq('id_ticket', ticketActual.id_ticket)
			.eq('id_deudor', usuarioActual)
			.eq('estado', 'Aceptada')
			.select('id_ticket')
			.maybeSingle();

		if (error) throw error;
		if (!data) throw new Error('El estado de esta deuda cambió. Actualiza la página e inténtalo de nuevo.');

		window.location.replace('./principal.html');
	} catch (error) {
		console.error('No se pudo registrar el pago:', error);
		alert('No se pudo registrar el pago: ' + error.message);
		botonPague.disabled = false;
		botonPague.textContent = 'Ya pagué';
	}
});

cargarPago();
