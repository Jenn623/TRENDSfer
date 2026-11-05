import { supabase } from './supabase.js';

const form = document.querySelector('.form-recuperarContraseña');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const correo = form.querySelector('input[name="correo"]').value.trim();

        try {
            // 1. Verificar si el correo existe en la tabla Usuarios
            const { data: usuario, error } = await supabase
                .from('Usuarios')
                .select('*')
                .eq('email', correo)
                .single();

            if (error || !usuario) {
                alert('El correo ingresado no está registrado.');
                return;
            }

            // 2. Generar un código aleatorio de 6 dígitos
            const codigoAleatorio = Math.floor(100000 + Math.random() * 900000).toString();

            // 3. Guardar el correo y el código aleatorio en localStorage
            localStorage.setItem('correoRecuperacion', correo);
            localStorage.setItem('codigoVerificacion', codigoAleatorio);

            // Muestra el código en una alerta para probar el flujo sin SMTP
            alert(`Código enviado a ${correo}: ${codigoAleatorio}`);
            console.log('Código de verificación generado:', codigoAleatorio);

            // 4. Redirigir a la pantalla de verificación
            window.location.href = 'RecuperarContraseña.html';

        } catch (err) {
            console.error(err);
            alert('Error al procesar la solicitud.');
        }
    });
}