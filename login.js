import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';
import { crearUrlConInvitacion, obtenerInvitacionAmigo } from './invitacion-amigo.js';

const formLogin = document.querySelector('.formIniciar-sesion');
const idPerfilInvitador = obtenerInvitacionAmigo();
const enlaceRegistro = document.querySelector('.link-crearCuenta a');

if (enlaceRegistro && idPerfilInvitador) {
    enlaceRegistro.href = crearUrlConInvitacion('./registro.html', idPerfilInvitador).href;
}

if (formLogin) {
    supabase.auth.getSession().then(async ({ data, error }) => {
        if (error) throw error;
        if (!data.session) return;

        const sesion = await obtenerPerfilActual();
        if (!sesion) return;
        window.location.replace(crearUrlConInvitacion(
            './principal.html',
            idPerfilInvitador
        ).href);
    }).catch((error) => {
        console.error('No se pudo revisar la sesión activa:', error);
    });
}

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault(); // Detiene el envío nativo del formulario

        // Capturamos los camposA
        const correoInput = formLogin.querySelector('input[name="correo"]');
        const contrasenaInput = formLogin.querySelector('input[name="contraseña"]') || formLogin.querySelector('input[name="contrasena"]');

        if (!correoInput || !contrasenaInput) {
            console.error('No se encontraron los inputs en el HTML');
            alert('Error: Verifique el nombre de los campos de entrada en el HTML');
            return;
        }

        const correoIngresado = correoInput.value.trim();
        const contrasenaIngresada = contrasenaInput.value.trim();

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: correoIngresado,
                password: contrasenaIngresada
            });

            if (authError) throw authError;

            const sesion = await obtenerPerfilActual();
            if (!sesion) {
                await supabase.auth.signOut();
                throw new Error('No se encontró el perfil vinculado a esta cuenta. Ejecuta primero la migración de Supabase.');
            }

            localStorage.removeItem('usuarioSesion');
            alert('¡Bienvenido ' + (sesion.perfil.apodo || sesion.perfil.nombre) + '! Redirigiendo...');
            window.location.href = crearUrlConInvitacion(
                './principal.html',
                idPerfilInvitador
            ).href;

        } catch (error) {
            await supabase.auth.signOut();
            console.error('Error durante el inicio de sesión:', error);
            alert('No se pudo iniciar sesión: ' + error.message);
        }
    });
}