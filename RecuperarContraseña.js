const form = document.querySelector('.form-recuperarContraseña');

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const codigoIngresado = form.querySelector('input[name="codigo"]').value.trim();
        const codigoGuardado = localStorage.getItem('codigoVerificacion');

        if (!codigoGuardado) {
            alert('El código ha expirado o no es válido. Vuelve a intentarlo.');
            window.location.href = 'olvidarcontraseña.html';
            return;
        }

        // Validar que el código ingresado coincida exactamente con el generado
        if (codigoIngresado === codigoGuardado) {
            alert('Código verificado con éxito.');
            window.location.href = 'NuevaContraseña.html';
        } else {
            alert('El código ingresado es incorrecto. Inténtalo de nuevo.');
        }
    });
}