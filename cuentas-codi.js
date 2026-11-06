import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

const formatoClabe = (clabe) => `${clabe.slice(0, 3)} ••••••••••••• ${clabe.slice(-2)}`;

export function iniciarCuentasCodi(root = document) {
	const formulario = root.querySelector('.Form-AgregarTarjeta');
	if (!formulario || formulario.dataset.inicializado === 'true') return;
	formulario.dataset.inicializado = 'true';

	const botonGuardar = formulario.querySelector('[type="submit"]');
	const lista = root.querySelector('[data-tarjetas-guardadas]');

	async function cargarCuentas() {
		const { data, error } = await supabase
			.from('Cuentas_Bancarias')
			.select('id_tarjeta, clabe_interbancaria, banco, nombre_titular, alias, numero_celular, id_registro_codi, tipo_cuenta')
			.order('creado_en', { ascending: false });
		if (error) throw error;

		lista.replaceChildren();
		if (!data.length) {
			const vacio = document.createElement('p');
			vacio.textContent = 'Aún no tienes cuentas CoDi guardadas.';
			lista.append(vacio);
			return;
		}

		data.forEach((cuenta) => {
			const articulo = document.createElement('article');
			const titulo = document.createElement('h2');
			const detalle = document.createElement('p');
			const eliminar = document.createElement('button');

			articulo.className = 'cuenta-codi-guardada';
			titulo.textContent = cuenta.alias?.trim() || cuenta.banco || 'Cuenta CoDi';
			const datos = [
				cuenta.banco,
				cuenta.nombre_titular,
				cuenta.clabe_interbancaria ? formatoClabe(cuenta.clabe_interbancaria) : null,
				cuenta.numero_celular,
				cuenta.id_registro_codi
			].filter(Boolean);
			detalle.textContent = datos.join(' · ');
			eliminar.type = 'button';
			eliminar.textContent = 'Eliminar';
			eliminar.addEventListener('click', async () => {
				if (!window.confirm('¿Quieres eliminar esta cuenta CoDi?')) return;
				eliminar.disabled = true;
				try {
					const { error: borrarError } = await supabase
						.from('Cuentas_Bancarias')
						.delete()
						.eq('id_tarjeta', cuenta.id_tarjeta);
					if (borrarError) throw borrarError;
					await cargarCuentas();
				} catch (error) {
					console.error('No se pudo eliminar la cuenta CoDi:', error);
					alert('No se pudo eliminar la cuenta: ' + error.message);
					eliminar.disabled = false;
				}
			});
			articulo.append(titulo, detalle, eliminar);
			lista.append(articulo);
		});
	}

	async function iniciar() {
		try {
			const sesion = await obtenerPerfilActual();
			if (!sesion) {
				window.location.replace('./index.html');
				return;
			}

			const nombre = sesion.perfil.apodo?.trim()
				|| sesion.perfil.nombre?.trim()
				|| sesion.authUser.email
				|| 'Usuario';
			document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
				elemento.textContent = nombre;
			});
			document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
				elemento.textContent = nombre.charAt(0).toUpperCase() || 'U';
			});
			await cargarCuentas();
			return true;
		} catch (error) {
			console.error('No se pudieron cargar las cuentas CoDi:', error);
			alert('No se pudieron cargar las cuentas CoDi: ' + error.message);
			return false;
		}
	}

	const listo = iniciar();
	formulario.addEventListener('submit', async (evento) => {
		evento.preventDefault();
		botonGuardar.disabled = true;

		try {
			if (!await listo) return;
			const clabe = formulario.elements.clabeInterbancaria.value.trim();
			const banco = formulario.elements.banco.value.trim();
			const nombreTitular = formulario.elements.nombreTitular.value.trim();
			const celular = formulario.elements.numeroCelular.value.trim();
			const idRegistro = formulario.elements.idRegistroCodi.value.trim();
			const alias = formulario.elements.alias.value.trim();

			if (!/^\d{18}$/.test(clabe)) {
				throw new Error('La CLABE interbancaria debe contener exactamente 18 dígitos.');
			}
			if (!banco || !nombreTitular) {
				throw new Error('Completa el banco y el nombre del titular.');
			}
			if (celular && !/^\+?[0-9]{10,15}$/.test(celular)) {
				throw new Error('El celular debe tener entre 10 y 15 dígitos; puedes anteponer +.');
			}

			const { error } = await supabase.from('Cuentas_Bancarias').insert({
				clabe_interbancaria: clabe,
				banco,
				nombre_titular: nombreTitular,
				alias: alias || null,
				numero_celular: celular || null,
				id_registro_codi: idRegistro || null
			});
			if (error) throw error;

			formulario.reset();
			await cargarCuentas();
			alert('Cuenta CoDi guardada correctamente.');
		} catch (error) {
			console.error('No se pudo guardar la cuenta CoDi:', error);
			alert('No se pudo guardar la cuenta CoDi: ' + error.message);
		} finally {
			botonGuardar.disabled = false;
		}
	});
}
