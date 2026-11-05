import { supabase } from './supabase.js';

const form = document.querySelector('.form-recuperarContraseña');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nuevaContrasena = form.querySelector('input[name="contraseña"]').value;
        const correo = localStorage.getItem('correoRecuperacion');

        if (!correo) {
            alert('Sesión expirada. Por favor reinicia el proceso de recuperación.');
            window.location.href = 'olvidarcontraseña.html';
            return;
        }

        try {
            // Actualizamos la contraseña en Supabase para el usuario correspondiente
            const { error } = await supabase
                .from('Usuarios')
                .update({ contraseña: nuevaContrasena })
                .eq('email', correo);

            if (error) throw error;

            // Limpiamos la variable temporal
            localStorage.removeItem('correoRecuperacion');

            alert('¡Contraseña actualizada con éxito! Inicia sesión con tu nueva contraseña.');
            window.location.href = 'index.html';

        } catch (err) {
            console.error(err);
            alert('Error al actualizar la contraseña: ' + err.message);
        }
    });
}