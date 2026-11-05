const CLAVE_SESION = 'usuarioSesion';
const CLAVE_TICKETS = 'ticketsTRENDSfer';
const formulario = document.querySelector('.Form-Ticket');

if (formulario) {
	formulario.addEventListener('submit', (evento) => {
		evento.preventDefault();

		let usuario;
		let tickets;

		try {
			usuario = JSON.parse(localStorage.getItem(CLAVE_SESION));
			tickets = JSON.parse(localStorage.getItem(CLAVE_TICKETS) || '[]');
		} catch (error) {
			alert('No se pudo leer la sesión o los tickets guardados.');
			return;
		}

		if (!usuario || typeof usuario !== 'object') {
			window.location.replace('index.html');
			return;
		}

		const correoCreador = usuario.email || usuario.correo;
		const monto = Number(formulario.elements.Monto.value);

		if (!correoCreador) {
			alert('La sesión no contiene el correo del usuario. Vuelve a iniciar sesión.');
			window.location.replace('index.html');
			return;
		}

		if (!Number.isFinite(monto) || monto <= 0) {
			alert('Ingresa un monto mayor que cero.');
			return;
		}

		if (!Array.isArray(tickets)) {
			tickets = [];
		}

		tickets.push({
			id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
			correoCreador,
			deudor: formulario.elements.deudor.value.trim(),
			monto,
			concepto: formulario.elements.Concepto.value.trim(),
			fecha: new Date().toISOString()
		});

		try {
			localStorage.setItem(CLAVE_TICKETS, JSON.stringify(tickets));
		} catch (error) {
			alert('No se pudo guardar el ticket en este navegador.');
			return;
		}

		window.location.href = 'principal.html';
	});
}
