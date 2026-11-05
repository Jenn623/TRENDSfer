const CLAVE_SESION = 'usuarioSesion';
const CLAVE_TICKETS = 'ticketsTRENDSfer';

function cargarSesion() {
	let usuario;

	try {
		usuario = JSON.parse(localStorage.getItem(CLAVE_SESION));
	} catch (error) {
		localStorage.removeItem(CLAVE_SESION);
	}

	if (!usuario || typeof usuario !== 'object') {
		window.location.replace('index.html');
		return;
	}

	const nombrePerfil = usuario.apodo || usuario.nombre || usuario.email || 'Usuario';
	const inicial = nombrePerfil.trim().charAt(0).toUpperCase() || 'U';
	const correoUsuario = usuario.email || usuario.correo;

	document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
		elemento.textContent = nombrePerfil;
	});

	document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
		elemento.textContent = inicial;
	});

	cargarTickets(correoUsuario);
}

function cargarTickets(correoUsuario) {
	let tickets = [];

	try {
		const guardados = JSON.parse(localStorage.getItem(CLAVE_TICKETS) || '[]');
		tickets = Array.isArray(guardados) ? guardados : [];
	} catch (error) {
		localStorage.removeItem(CLAVE_TICKETS);
	}

	const ticketsPropios = tickets.filter((ticket) => ticket.correoCreador === correoUsuario);
	const listaDeudores = document.querySelector('[data-tickets-propios]');
	const listaDeudas = document.querySelector('[data-tickets-debo]');
	const totalTeDeben = ticketsPropios.reduce((total, ticket) => total + Number(ticket.monto || 0), 0);
	const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

	document.getElementById('deben').textContent = formatoMoneda.format(totalTeDeben);
	document.getElementById('debes').textContent = formatoMoneda.format(0);

	if (ticketsPropios.length === 0) {
		listaDeudores.textContent = 'Aún no tienes personas que te deban.';
	} else {
		ticketsPropios.forEach((ticket) => {
			const fila = document.createElement('div');
			const detalle = document.createElement('p');
			const monto = document.createElement('p');

			fila.className = 'deudor-persona';
			detalle.className = 'nombre';
			detalle.textContent = `${ticket.deudor} · ${ticket.concepto}`;
			monto.className = 'monto';
			monto.textContent = formatoMoneda.format(Number(ticket.monto));
			fila.append(detalle, monto);
			listaDeudores.append(fila);
		});
	}

	listaDeudas.textContent = 'Aún no tienes tickets por pagar.';
}

cargarSesion();
