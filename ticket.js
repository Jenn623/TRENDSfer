import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

const formulario = document.querySelector('.Form-Ticket');
const selectorDeudor = formulario?.elements.deudor;

async function cargarUsuarios() {
	try {
		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('index.html');
			return;
		}

		const nombrePerfil = sesion.perfil.apodo || sesion.perfil.nombre || sesion.authUser.email || 'Usuario';
		const inicial = nombrePerfil.trim().charAt(0).toUpperCase() || 'U';
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = inicial;
		});

		const { data: usuarios, error } = await supabase
			.from('Usuarios')
			.select('id_usuarios, nombre, apellido, apodo, email')
			.neq('id_usuarios', sesion.perfil.id_usuarios)
			.order('apodo', { ascending: true });

		if (error) throw error;

		usuarios.forEach((usuario) => {
			const opcion = document.createElement('option');
			const nombre = usuario.apodo || usuario.nombre;
			opcion.value = usuario.id_usuarios;
			opcion.textContent = `${nombre} (${usuario.email})`;
			selectorDeudor.append(opcion);
		});

		if (usuarios.length === 0) {
			selectorDeudor.disabled = true;
			alert('No hay otros usuarios registrados para recibir el ticket.');
		}
	} catch (error) {
		console.error('No se pudieron cargar los usuarios:', error);
		alert('No se pudieron cargar los usuarios: ' + error.message);
	}
}

if (formulario) {
	cargarUsuarios();

	formulario.addEventListener('submit', async (evento) => {
		evento.preventDefault();

		try {
			const sesion = await obtenerPerfilActual();
			if (!sesion) {
				window.location.replace('index.html');
				return;
			}

			const monto = Number(formulario.elements.Monto.value);
			const concepto = formulario.elements.Concepto.value.trim();
			const idDeudor = selectorDeudor.value;

			if (!idDeudor || !Number.isFinite(monto) || monto <= 0 || !concepto) {
				alert('Selecciona un usuario e ingresa un monto y concepto válidos.');
				return;
			}

			const { error } = await supabase.from('Tickets').insert({
				id_acreedor: sesion.perfil.id_usuarios,
				id_deudor: idDeudor,
				monto,
				concepto
			});

			if (error) throw error;
			window.location.href = 'principal.html';
		} catch (error) {
			console.error('No se pudo crear el ticket:', error);
			alert('No se pudo crear el ticket: ' + error.message);
		}
	});
}
