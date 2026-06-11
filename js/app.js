/**
 * GESALUD - Portal de Médicos SPA Core Logic
 * structured under SOLID and DRY principles.
 */

// =========================================================================
// 1. STORAGE SERVICE (SOLID: Single Responsibility - Data Persistence)
// =========================================================================
class StorageService {
    static KEYS = {
        TOKEN: 'medico_auth_token',
        USER: 'medico_user_data',
        REQ_CHANGE: 'medico_req_change'
    };

    getToken() {
        return localStorage.getItem(StorageService.KEYS.TOKEN) || '';
    }

    setToken(token) {
        if (token) {
            localStorage.setItem(StorageService.KEYS.TOKEN, token.trim());
        } else {
            localStorage.removeItem(StorageService.KEYS.TOKEN);
        }
    }

    getUser() {
        const data = localStorage.getItem(StorageService.KEYS.USER);
        return data ? JSON.parse(data) : null;
    }

    setUser(user) {
        if (user) {
            localStorage.setItem(StorageService.KEYS.USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(StorageService.KEYS.USER);
        }
    }

    getRequirePasswordChange() {
        // Devuelve true si el flag está explícitamente configurado como 'true'
        return localStorage.getItem(StorageService.KEYS.REQ_CHANGE) === 'true';
    }

    setRequirePasswordChange(reqChange) {
        localStorage.setItem(StorageService.KEYS.REQ_CHANGE, reqChange ? 'true' : 'false');
    }

    clearSession() {
        localStorage.removeItem(StorageService.KEYS.TOKEN);
        localStorage.removeItem(StorageService.KEYS.USER);
        localStorage.removeItem(StorageService.KEYS.REQ_CHANGE);
    }
}

// =========================================================================
// 2. API SERVICE (SOLID: Single Responsibility - Endpoint Communication)
// =========================================================================
class ApiService {
    constructor(storageService) {
        this.storage = storageService;
        this.baseUrl = '../APIPacientes'; // Localizado relativo a la carpeta FHIRmedicos
    }

    /**
     * Executes AJAX request to APIPacientes endpoints.
     * @param {string} endpoint - Endpoint filename (e.g. 'login_medico.php')
     * @param {string} method - HTTP method ('GET', 'POST')
     * @param {object} data - Payload body
     * @returns {Promise}
     */
    request(endpoint, method = 'POST', data = null) {
        const url = `${this.baseUrl}/${endpoint}`;
        const headers = {
            'Content-Type': 'application/json'
        };

        const token = this.storage.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return new Promise((resolve, reject) => {
            $.ajax({
                url: url,
                type: method,
                headers: headers,
                data: data ? JSON.stringify(data) : null,
                dataType: 'json',
                success: (response) => resolve(response),
                error: (xhr) => {
                    let errorMessage = 'Error de conexión con el servidor.';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    } else if (xhr.responseText) {
                        try {
                            const parsed = JSON.parse(xhr.responseText);
                            errorMessage = parsed.message || errorMessage;
                        } catch(e) {
                            // Non-json response
                        }
                    }
                    reject({
                        status: xhr.status,
                        message: errorMessage
                    });
                }
            });
        });
    }
}

// =========================================================================
// 3. UI SERVICE (SOLID: Single Responsibility - DOM & View Transitions)
// =========================================================================
class UiService {
    showToast(message, type = 'info') {
        const container = $('.toast-container');
        if (container.length === 0) return;

        const toastId = `toast-${Date.now()}`;
        const toastHtml = `
            <div id="${toastId}" class="medico-toast toast-${type}" role="alert">
                <span class="toast-message">${message}</span>
                <button type="button" class="toast-close" aria-label="Close">&times;</button>
            </div>
        `;

        const $toast = $(toastHtml);
        container.append($toast);

        const timer = setTimeout(() => {
            this.dismissToast($toast);
        }, 4000);

        $toast.find('.toast-close').on('click', () => {
            clearTimeout(timer);
            this.dismissToast($toast);
        });
    }

    dismissToast($toast) {
        $toast.css('animation', 'fadeOut 0.3s ease forwards');
        $toast.one('animationend', () => {
            $toast.remove();
        });
    }

    toggleLoading(selector, isLoading) {
        const $element = $(selector);
        const overlay = $element.find('.loading-overlay');
        if (isLoading) {
            overlay.addClass('active');
        } else {
            overlay.removeClass('active');
        }
    }

    /**
     * Switch view states dynamically (SPA routing Simulation)
     * @param {string} viewName - 'login', 'change-password', 'dashboard'
     */
    switchView(viewName) {
        $('.view-container').addClass('d-none');
        $(`#view-${viewName}`).removeClass('d-none');
    }
}

// =========================================================================
// 4. FORM HANDLER (SOLID: Open/Closed - Client interactions)
// =========================================================================
class FormHandler {
    constructor(apiService, uiService, storageService) {
        this.api = apiService;
        this.ui = uiService;
        this.storage = storageService;
    }

    /**
     * Generic form action wrapper to reduce code duplication (DRY)
     */
    async executeFormAction(formSelector, loadingCardSelector, actionFn) {
        const $form = $(formSelector);
        if ($form[0] && !$form[0].checkValidity()) {
            $form[0].reportValidity();
            return;
        }

        this.ui.toggleLoading(loadingCardSelector, true);
        try {
            await actionFn();
        } catch (error) {
            this.ui.showToast(error.message || 'Ocurrió un error inesperado.', 'danger');
        } finally {
            this.ui.toggleLoading(loadingCardSelector, false);
        }
    }

    login(event) {
        event.preventDefault();

        this.executeFormAction('#form-login', '#view-login .portal-card', async () => {
            const idntfccion = $('#login_username').val().trim();
            const password = $('#login_password').val();

            const response = await this.api.request('login_medico.php', 'POST', {
                idntfccion_mdcos: idntfccion,
                password: password
            });

            if (response.status === 'success') {
                // Almacenar credenciales y token
                this.storage.setToken(response.token);
                this.storage.setUser(response.user);
                
                const requireChange = response.require_password_change === true;
                this.storage.setRequirePasswordChange(requireChange);

                this.ui.showToast('Autenticación exitosa.', 'success');

                // Lógica de Redirección Obligatoria
                if (requireChange) {
                    this.ui.showToast('Contraseña por defecto detectada. Debe actualizarla obligatoriamente.', 'info');
                    this.ui.switchView('change-password');
                } else {
                    await this.loadDashboardData();
                    this.ui.switchView('dashboard');
                }
            } else {
                throw new Error(response.message || 'Error al iniciar sesión.');
            }
        });
    }

    changePassword(event) {
        event.preventDefault();

        this.executeFormAction('#form-change-password', '#view-change-password .portal-card', async () => {
            const idntfccion = $('#change_username').val().trim();
            if (!idntfccion) {
                throw new Error('El campo Usuario (Identificación) es obligatorio.');
            }

            const currentPassword = $('#change_current_password').val();
            const newPassword = $('#change_new_password').val();
            const confirmPassword = $('#change_confirm_password').val();

            if (newPassword !== confirmPassword) {
                throw new Error('La confirmación de la contraseña no coincide.');
            }

            const response = await this.api.request('change_password_medico.php', 'POST', {
                idntfccion_mdcos: idntfccion,
                old_password: currentPassword,
                new_password: newPassword
            });

            if (response.status === 'success') {
                this.ui.showToast('Contraseña actualizada con éxito.', 'success');

                // Limpiar campos
                $('#form-change-password')[0].reset();

                const token = this.storage.getToken();
                if (token) {
                    // Si ya estaba autenticado (cambio obligatorio)
                    this.storage.setRequirePasswordChange(false);
                    await this.loadDashboardData();
                    this.ui.switchView('dashboard');
                } else {
                    // Si vino voluntariamente desde el Login
                    this.ui.showToast('Por favor, inicie sesión con su nueva contraseña.', 'success');
                    this.ui.switchView('login');
                }
            } else {
                throw new Error(response.message || 'Error al actualizar contraseña.');
            }
        });
    }

    async loadDashboardData() {
        const user = this.storage.getUser();
        if (user) {
            $('#dash-medico-name').text(user.name);
            $('#dash-medico-id').text(`ID: ${user.id}`);
            $('#dash-medico-email').text(user.email || 'N/A');

            // Cargar fecha actual formateada en español
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const fechaHoy = new Date().toLocaleDateString('es-ES', options);
            // Capitalizar la primera letra
            const fechaHoyFormateada = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);
            $('#greet-date').text(fechaHoyFormateada);

            try {
                // Hacer petición AJAX GET a getMedicoCompleto.php en APIPacientes
                const response = await this.api.request(`getMedicoCompleto.php?idntfccion_mdcos=${user.id}`, 'GET');
                if (response.status === 'success' && response.data && response.data.length > 0) {
                    const info = response.data[0];
                    
                    // Reconstruir nombre completo a partir de campos individuales de nombre/apellido
                    const nombres = [info.primer_nombre, info.segundo_nombre].filter(Boolean).join(' ');
                    const apellidos = [info.primer_apellido, info.segundo_apellido].filter(Boolean).join(' ');
                    let nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ');
                    
                    if (!nombreCompleto) {
                        nombreCompleto = info.nmbres || user.name;
                    }

                    // Actualizar saludo
                    $('#greet-doctor-name').text(`Dr. ${nombreCompleto}`);

                    // Actualizar especialidad con la descripción cargada
                    const especialidad = info.desc_espcldad || info.espcldad || 'General';
                    $('#greet-doctor-specialty').text(especialidad);

                    // Mostrar banner
                    $('#greeting-banner').removeClass('d-none');
                } else {
                    // Fallback
                    $('#greet-doctor-name').text(`Dr. ${user.name}`);
                    $('#greet-doctor-specialty').text('General');
                    $('#greeting-banner').removeClass('d-none');
                }
            } catch (error) {
                console.error("Error al cargar la información completa del médico:", error);
                // Fallback
                $('#greet-doctor-name').text(`Dr. ${user.name}`);
                $('#greet-doctor-specialty').text('General');
                $('#greeting-banner').removeClass('d-none');
            }

            // Cargar la agenda de pacientes del día
            await this.loadPatientAgenda(user.id);
        }
    }

    async loadPatientAgenda(medicoId) {
        const loading = $('#agenda-loading');
        const tableContainer = $('#agenda-table-container');
        const tbody = $('#agenda-table-body');
        const empty = $('#agenda-empty');

        loading.removeClass('d-none');
        tableContainer.addClass('d-none');
        tbody.empty();
        empty.addClass('d-none');

        // Calcular fecha de hoy y mañana en formato DD/MM/YYYY
        const today = new Date();
        const formatDateString = (date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };
        const fechaInicio = formatDateString(today);

        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const fechaFin = formatDateString(tomorrow);

        $('#agenda-date-badge').text(fechaInicio);

        try {
            // Invocar el endpoint getInfoCitas.php
            const url = `getInfoCitas.php?id_medico=${medicoId}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&page=1&limit=100`;
            const response = await this.api.request(url, 'GET');

            if (response.status === 'success' && response.data && response.data.length > 0) {
                const citas = response.data;
                
                citas.forEach((cita, index) => {
                    // Procesar fecha y hora
                    let fechaStr = 'N/A';
                    let horaStr = 'N/A';
                    
                    if (cita.fecha_atencion) {
                        const parts = cita.fecha_atencion.split(' ');
                        if (parts.length === 2) {
                            fechaStr = parts[0];
                            horaStr = parts[1].substring(0, 5); // HH:MM
                        } else {
                            fechaStr = cita.fecha_atencion;
                        }
                    }

                    // Concatenar nombre completo del paciente
                    const nombres = [cita.primer_nombre, cita.segundo_nombre].filter(Boolean).join(' ');
                    const apellidos = [cita.primer_apellido, cita.segundo_apellido].filter(Boolean).join(' ');
                    const nombrePaciente = [nombres, apellidos].filter(Boolean).join(' ') || 'Paciente sin nombre';

                    // Clasificación del estado mediante un círculo indicador y texto negro
                    let statusText = 'Pendiente';
                    let dotClass = 'bg-secondary-subtle border border-secondary'; // Gris
                    let rowClass = '';

                    // Simulación: Resaltamos el primer paciente como "En consulta" si todos vienen vacíos
                    let statusVal = (cita.estado_atencion || '').trim().toUpperCase();
                    if (!statusVal && index === 0) {
                        statusVal = 'EN_CONSULTA';
                    }

                    if (statusVal === 'C' || statusVal === 'EC' || statusVal === 'EN CONSULTA' || statusVal === 'EN_CONSULTA') {
                        statusText = 'En consulta';
                        dotClass = 'bg-primary'; // Azul
                        rowClass = 'table-active-consultation'; // Fila destacada
                    } else if (statusVal === 'E' || statusVal === 'EE' || statusVal === 'EN ESPERA' || statusVal === 'EN_ESPERA') {
                        statusText = 'En espera';
                        dotClass = 'bg-success'; // Verde
                        rowClass = '';
                    }

                    const rowHtml = `
                        <tr class="${rowClass}">
                            <td>
                                <span class="fw-semibold text-primary d-block">${horaStr}</span>
                                <span class="fs-8 text-muted">${fechaStr}</span>
                            </td>
                            <td>
                                <span class="font-monospace text-secondary fs-7.5">${cita.identificacion}</span>
                            </td>
                            <td>
                                <span class="fw-semibold text-primary">${nombrePaciente}</span>
                            </td>
                            <td>
                                <span class="badge bg-light text-primary border mb-1 font-monospace fs-9">${cita.codigo_item}</span>
                                <span class="d-block text-secondary line-clamp-1 fs-7.5" title="${cita.procedimiento_descripcion}">${cita.procedimiento_descripcion}</span>
                            </td>
                            <td>
                                <span class="fw-medium text-primary d-block fs-7.5">${cita.empresa_descripcion}</span>
                                <span class="fs-8 text-muted font-monospace">NIT: ${cita.nit_empresa}</span>
                            </td>
                            <td>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="status-dot d-inline-block rounded-circle ${dotClass}" style="width: 10px; height: 10px; min-width: 10px;"></span>
                                    <span class="status-text fw-medium text-dark">${statusText}</span>
                                </div>
                            </td>
                            <td>
                                <button type="button" class="btn btn-sm btn-sky btn-atender py-1 px-2.5 fs-8" data-id="${cita.identificacion}" data-name="${nombrePaciente}">
                                    <i class="bi bi-folder2-open me-1"></i>Atender
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(rowHtml);
                });

                tableContainer.removeClass('d-none');

                // Agregar evento interactivo para hacer click en la fila y marcar como "En consulta"
                const self = this;
                tbody.off('click', 'tr').on('click', 'tr', function() {
                    // Restablecer estados previos
                    tbody.find('tr').removeClass('table-active-consultation');
                    tbody.find('tr').each(function() {
                        const $dot = $(this).find('.status-dot');
                        const $text = $(this).find('.status-text');
                        if ($text.text() === 'En consulta') {
                            $text.text('Pendiente');
                            $dot.removeClass('bg-primary').addClass('bg-secondary-subtle border border-secondary');
                        }
                    });

                    // Marcar fila seleccionada como En consulta
                    $(this).addClass('table-active-consultation');
                    const $dot = $(this).find('.status-dot');
                    const $text = $(this).find('.status-text');
                    $text.text('En consulta');
                    $dot.removeClass('bg-secondary-subtle border border-secondary bg-success bg-primary').addClass('bg-primary');

                    // Actualizar KPIs en tiempo real
                    self.updateClinicalKpis(tbody);
                });

                // Actualizar KPIs al inicio
                this.updateClinicalKpis(tbody);

            } else {
                empty.removeClass('d-none');
                this.clearKpis();
            }
        } catch (error) {
            console.error("Error al cargar la agenda:", error);
            empty.removeClass('d-none');
            this.clearKpis();
            this.ui.showToast('Error al cargar la agenda del día.', 'danger');
        } finally {
            loading.addClass('d-none');
        }
    }

    updateClinicalKpis(tbody) {
        const total = tbody.find('tr').length;
        let consulta = 0;
        let espera = 0;
        let pendiente = 0;

        tbody.find('tr').each(function() {
            const text = $(this).find('.status-text').text().trim();
            if (text === 'En consulta') {
                consulta++;
            } else if (text === 'En espera') {
                espera++;
            } else {
                pendiente++;
            }
        });

        $('#kpi-total').text(total);
        $('#kpi-consulta').text(consulta);
        $('#kpi-espera').text(espera);
        $('#kpi-pendientes').text(pendiente);
    }

    clearKpis() {
        $('#kpi-total').text('0');
        $('#kpi-consulta').text('0');
        $('#kpi-espera').text('0');
        $('#kpi-pendientes').text('0');
    }

    async loadPatientHistory(pacienteId) {

        // Show loading status in the sidebar cards and panel containers
        $('#list-patologicos-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-alergicos-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-familiares-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-farmacos-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');

        // Reset all forms
        if ($('#form-patologico')[0]) $('#form-patologico')[0].reset();
        if ($('#form-alergico')[0]) $('#form-alergico')[0].reset();
        if ($('#form-familiar')[0]) $('#form-familiar')[0].reset();
        if ($('#form-farmaco')[0]) $('#form-farmaco')[0].reset();

        // Perform parallel calls
        const pCondition = this.loadConditions(pacienteId);
        const pAllergy = this.loadAllergies(pacienteId);
        const pFamily = this.loadFamilyHistory(pacienteId);
        const pMedication = this.loadMedications(pacienteId);

        await Promise.all([pCondition, pAllergy, pFamily, pMedication]);
    }

    async loadConditions(pacienteId) {
        try {
            const res = await this.api.request(`getCondition.php?id_pcnte=${pacienteId}`, 'GET');
            this.currentConditions = res.data || [];
            const sideContainer = $('#list-patologicos-existentes');
            sideContainer.empty();

            if (res.status === 'success' && res.data && res.data.length > 0) {
                res.data.forEach(item => {
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 70%;">
                                <span class="badge bg-sky-pale text-primary border font-monospace me-1 fs-8">${item.cie_10 || 'CIE-10'}</span>
                                <span class="fw-medium text-dark" title="${item.descripcion}">${item.descripcion}</span>
                            </div>
                            <span class="badge bg-light text-secondary border fs-8">${item.status_clinico_display || item.status_clinico_code || 'Active'}</span>
                        </div>
                    `);
                });
            } else {
                sideContainer.html('<div class="text-muted fs-8.5 text-center py-1">Sin antecedentes.</div>');
            }
        } catch (error) {
            console.error("Error loading conditions:", error);
            $('#list-patologicos-existentes').html('<div class="text-muted fs-8.5 text-center py-1 text-danger">Error.</div>');
        }
    }

    async loadAllergies(pacienteId) {
        try {
            const res = await this.api.request(`getAllergyIntolerance.php?id_pcnte=${pacienteId}`, 'GET');
            this.currentAllergies = res.data || [];
            const sideContainer = $('#list-alergicos-existentes');
            sideContainer.empty();

            if (res.status === 'success' && res.data && res.data.length > 0) {
                res.data.forEach(item => {
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 70%;">
                                <span class="badge bg-danger-subtle text-danger border me-1 fs-8" style="font-size: 0.77rem !important;">${item.tipo_alergia_nombre || 'Alergia'}</span>
                                <span class="fw-medium text-dark" title="${item.descripcion}">${item.descripcion}</span>
                            </div>
                            <span class="badge bg-light text-secondary border fs-8">${item.estado_clinico_display || item.estado || 'Active'}</span>
                        </div>
                    `);
                });
            } else {
                sideContainer.html('<div class="text-muted fs-8.5 text-center py-1">Sin antecedentes.</div>');
            }
        } catch (error) {
            console.error("Error loading allergies:", error);
            $('#list-alergicos-existentes').html('<div class="text-muted fs-8.5 text-center py-1 text-danger">Error.</div>');
        }
    }

    async loadFamilyHistory(pacienteId) {
        try {
            const res = await this.api.request(`getFamilyMemberHistory.php?id_pcnte=${pacienteId}`, 'GET');
            this.currentFamilyHistory = res.data || [];
            const sideContainer = $('#list-familiares-existentes');
            sideContainer.empty();

            if (res.status === 'success' && res.data && res.data.length > 0) {
                res.data.forEach(item => {
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 70%;">
                                <span class="badge bg-secondary-subtle text-secondary border me-1 fs-8" style="font-size: 0.77rem !important;">${item.parentesco_nombre || 'Familiar'}</span>
                                <span class="fw-medium text-dark" title="${item.descripcion}">${item.descripcion}</span>
                            </div>
                            <span class="text-muted fw-semibold fs-8">${item.edad_diagnostico !== null ? item.edad_diagnostico + ' años' : 'N/A'}</span>
                        </div>
                    `);
                });
            } else {
                sideContainer.html('<div class="text-muted fs-8.5 text-center py-1">Sin antecedentes.</div>');
            }
        } catch (error) {
            console.error("Error loading family history:", error);
            $('#list-familiares-existentes').html('<div class="text-muted fs-8.5 text-center py-1 text-danger">Error.</div>');
        }
    }

    async loadMedications(pacienteId) {
        try {
            const res = await this.api.request(`getMedicationStatement.php?id_pcnte=${pacienteId}`, 'GET');
            this.currentMedications = res.data || [];
            const sideContainer = $('#list-farmacos-existentes');
            sideContainer.empty();

            if (res.status === 'success' && res.data && res.data.length > 0) {
                res.data.forEach(item => {
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 70%;">
                                <span class="fw-semibold text-primary fs-8 text-ellipsis d-block" title="${item.descripcion}">${item.descripcion}</span>
                                <span class="fs-9 text-muted text-ellipsis d-block" title="${item.observaciones || ''}">${item.observaciones || 'Sin especificaciones'}</span>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <span class="badge bg-sky-pale text-primary border fs-8 me-1">${item.estado || 'Active'}</span>
                                <button type="button" class="btn btn-xs btn-sky-outline py-0.5 px-1.5 fs-9 btn-copy-med" data-med="${item.descripcion}">
                                    <i class="bi bi-copy"></i> Copiar
                                </button>
                            </div>
                        </div>
                    `);
                });
            } else {
                sideContainer.html('<div class="text-muted fs-8.5 text-center py-1">Sin antecedentes.</div>');
            }
        } catch (error) {
            console.error("Error loading medications:", error);
            $('#list-farmacos-existentes').html('<div class="text-muted fs-8.5 text-center py-1 text-danger">Error.</div>');
        }
    }

    savePatologico(event) {
        event.preventDefault();
        const pacienteId = this.currentPatientId;
        if (!pacienteId) return;

        this.executeFormAction('#form-patologico', '#panel-antecedentes-card', async () => {
            const payload = {
                id_pcnte: pacienteId,
                cie_10: $('#pat_cie10').length ? ($('#pat_cie10').val() || '').trim() || null : null,
                cie_11: $('#pat_cie11').length ? ($('#pat_cie11').val() || '').trim() || null : null,
                codigo: $('#pat_codigo').length ? ($('#pat_codigo').val() || '').trim() || null : null,
                edad_diagnostico: ($('#pat_edad').length && $('#pat_edad').val() !== '' && $('#pat_edad').val() !== undefined) ? parseInt($('#pat_edad').val(), 10) : null,
                descripcion: $('#pat_descripcion').length ? ($('#pat_descripcion').val() || '').trim() : '',
                estado: $('#pat_estado').length ? $('#pat_estado').val() : null,
                estado_verificacion: $('#pat_verif').length ? $('#pat_verif').val() : null,
                observaciones: $('#pat_observaciones').length ? ($('#pat_observaciones').val() || '').trim() || null : null
            };

            const response = await this.api.request('createCondition.php', 'POST', payload);
            if (response.status === 'success') {
                this.ui.showToast('Antecedente patológico guardado exitosamente.', 'success');
                $('#form-patologico')[0].reset();
                await this.loadConditions(pacienteId);
                this.updateSmartClinicalSummary($('#sidebar-patient-age').text(), $('#sidebar-patient-sex').text());
            } else {
                throw new Error(response.message || 'Error al guardar antecedente patológico.');
            }
        });
    }

    saveAlergico(event) {
        event.preventDefault();
        const pacienteId = this.currentPatientId;
        if (!pacienteId) return;

        this.executeFormAction('#form-alergico', '#panel-antecedentes-card', async () => {
            const payload = {
                id_pcnte: pacienteId,
                tipoalergia: $('#ale_tipo').length ? $('#ale_tipo').val() : null,
                codigo: $('#ale_codigo').length ? ($('#ale_codigo').val() || '').trim() || null : null,
                descripcion: $('#ale_descripcion').length ? ($('#ale_descripcion').val() || '').trim() : '',
                estado: $('#ale_estado').length ? $('#ale_estado').val() : null,
                estado_verificacion: $('#ale_verif').length ? $('#ale_verif').val() : null,
                observaciones: $('#ale_observaciones').length ? ($('#ale_observaciones').val() || '').trim() || null : null
            };

            const response = await this.api.request('createAllergyIntolerance.php', 'POST', payload);
            if (response.status === 'success') {
                this.ui.showToast('Antecedente alérgico guardado exitosamente.', 'success');
                $('#form-alergico')[0].reset();
                await this.loadAllergies(pacienteId);
                this.updateSmartClinicalSummary($('#sidebar-patient-age').text(), $('#sidebar-patient-sex').text());
            } else {
                throw new Error(response.message || 'Error al guardar antecedente alérgico.');
            }
        });
    }

    saveFamiliar(event) {
        event.preventDefault();
        const pacienteId = this.currentPatientId;
        if (!pacienteId) return;

        this.executeFormAction('#form-familiar', '#panel-antecedentes-card', async () => {
            const payload = {
                id_pcnte: pacienteId,
                parentesco: $('#fam_parentesco').length ? $('#fam_parentesco').val() : null,
                cie_10: $('#fam_cie10').length ? ($('#fam_cie10').val() || '').trim() || null : null,
                cie_11: $('#fam_cie11').length ? ($('#fam_cie11').val() || '').trim() || null : null,
                codigo: $('#fam_codigo').length ? ($('#fam_codigo').val() || '').trim() || null : null,
                descripcion: $('#fam_descripcion').length ? ($('#fam_descripcion').val() || '').trim() : '',
                estado: $('#fam_estado').length ? $('#fam_estado').val() : null,
                edad_diagnostico: ($('#fam_edad').length && $('#fam_edad').val() !== '' && $('#fam_edad').val() !== undefined) ? parseInt($('#fam_edad').val(), 10) : null,
                observaciones: $('#fam_observaciones').length ? ($('#fam_observaciones').val() || '').trim() || null : null
            };

            const response = await this.api.request('createFamilyMemberHistory.php', 'POST', payload);
            if (response.status === 'success') {
                this.ui.showToast('Antecedente familiar guardado exitosamente.', 'success');
                $('#form-familiar')[0].reset();
                await this.loadFamilyHistory(pacienteId);
                this.updateSmartClinicalSummary($('#sidebar-patient-age').text(), $('#sidebar-patient-sex').text());
            } else {
                throw new Error(response.message || 'Error al guardar antecedente familiar.');
            }
        });
    }

    saveFarmaco(event) {
        event.preventDefault();
        const pacienteId = this.currentPatientId;
        if (!pacienteId) return;

        this.executeFormAction('#form-farmaco', '#panel-antecedentes-card', async () => {
            const payload = {
                id_pcnte: pacienteId,
                codigo: $('#far_codigo').length ? ($('#far_codigo').val() || '').trim() || null : null,
                descripcion: $('#far_descripcion').length ? ($('#far_descripcion').val() || '').trim() : '',
                estado: $('#far_estado').length ? $('#far_estado').val() : null,
                observaciones: $('#far_observaciones').length ? ($('#far_observaciones').val() || '').trim() || null : null
            };

            const response = await this.api.request('createMedicationStatement.php', 'POST', payload);
            if (response.status === 'success') {
                this.ui.showToast('Antecedente farmacológico guardado exitosamente.', 'success');
                $('#form-farmaco')[0].reset();
                await this.loadMedications(pacienteId);
                this.updateSmartClinicalSummary($('#sidebar-patient-age').text(), $('#sidebar-patient-sex').text());
            } else {
                throw new Error(response.message || 'Error al guardar antecedente farmacológico.');
            }
        });
    }

    updateSmartClinicalSummary(ageText, genderText) {
        const name = this.currentPatientName || 'El paciente';
        const conditions = this.currentConditions || [];
        const allergies = this.currentAllergies || [];
        const medications = this.currentMedications || [];
        
        const badgesContainer = $('#smart-clinical-summary-badges');
        badgesContainer.empty();


        // Standard Dynamic summary in Spanish
        let summaryParts = [];
        summaryParts.push(`<strong>${name}</strong> es un paciente de <strong>${ageText}</strong> de sexo <strong>${genderText}</strong>.`);

        if (conditions.length > 0) {
            const activeConditions = conditions.map(c => c.descripcion).join(', ');
            summaryParts.push(`Presenta antecedentes de: <span class="text-primary fw-semibold">${activeConditions}</span>.`);
        } else {
            summaryParts.push(`No se registran antecedentes patológicos activos en el sistema.`);
        }

        if (medications.length > 0) {
            const activeMeds = medications.map(m => m.descripcion).join(', ');
            summaryParts.push(`Actualmente bajo tratamiento con: <span class="text-success fw-semibold">${activeMeds}</span>.`);
        }

        if (allergies.length > 0) {
            const activeAllergies = allergies.map(a => `${a.descripcion} (${a.tipo_alergia_nombre || 'Alergia'})`).join(', ');
            summaryParts.push(`<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill me-1"></i>Alerta de Alergias:</span> El paciente es sensible a: <strong class="text-danger">${activeAllergies}</strong>.`);
        } else {
            summaryParts.push(`Sin reporte de alergias conocidas o intolerancias.`);
        }

        $('#smart-clinical-summary-text').html(summaryParts.join(' '));

        // Smart dynamic tag parsing
        let tagsFound = false;
        conditions.forEach(c => {
            const desc = c.descripcion.toLowerCase();
            if (desc.includes('dolor') || desc.includes('pecho') || desc.includes('torácico') || desc.includes('pain') || desc.includes('chest')) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-orange">Dolor Torácico</span>`);
                tagsFound = true;
            }
            if (desc.includes('disnea') || desc.includes('respirar') || desc.includes('dyspnea')) {
                badgesContainer.append(`<span class="risk-tag-badge" style="background-color: #fef08a !important; color: #854d0e !important; border-radius: 50px; padding: 0.25rem 0.75rem; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center;">Disnea Leve</span>`);
                tagsFound = true;
            }
            if (desc.includes('hipertensión') || desc.includes('presión') || desc.includes('hypertension') || desc.includes('tensión')) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-orange">Hipertensión Art.</span>`);
                tagsFound = true;
            }
            if (desc.includes('cardio') || desc.includes('coronaria') || desc.includes('isquémica') || desc.includes('cad') || desc.includes('infarto')) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-yellow">Heredo-Fam CAD</span>`);
                tagsFound = true;
            }
        });

        // Add standard fallbacks if no specific tags were found
        if (!tagsFound) {
            if (allergies.length > 0) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-red"><i class="bi bi-virus me-1"></i>Alérgeno Crítico</span>`);
            }
            if (conditions.length > 0) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-orange"><i class="bi bi-heart-pulse me-1"></i>Patología Activa</span>`);
            }
            if (medications.length > 0) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-yellow"><i class="bi bi-capsule me-1"></i>Farmacoterapia</span>`);
            }
            if (allergies.length === 0 && conditions.length === 0) {
                badgesContainer.append(`<span class="risk-tag-badge" style="background-color: #d1fae5 !important; color: #065f46 !important;"><i class="bi bi-shield-check me-1"></i>Bajo Riesgo</span>`);
            }
        }
    }

    formatMockupDate(dateStr) {
        if (!dateStr) return 'Fecha N/A';
        try {
            const datePart = dateStr.trim().split(' ')[0];
            
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                return datePart;
            }
            
            const separators = /[-/]/;
            const parts = datePart.split(separators);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    const year = parts[0];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[2].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
                
                const monthsES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                const monthsEN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                
                let day = parts[0];
                let monthStr = parts[1].toUpperCase();
                let yearStr = parts[2];
                
                let monthNum = parseInt(monthStr, 10);
                if (isNaN(monthNum)) {
                    let idx = monthsES.indexOf(monthStr);
                    if (idx === -1) {
                        idx = monthsEN.indexOf(monthStr);
                    }
                    if (idx !== -1) {
                        monthNum = idx + 1;
                    }
                }
                
                if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                    const month = monthNum.toString().padStart(2, '0');
                    day = day.padStart(2, '0');
                    
                    let year = yearStr;
                    if (year.length === 2) {
                        const currentYear = new Date().getFullYear();
                        const century = Math.floor(currentYear / 100) * 100;
                        const shortYear = parseInt(year, 10);
                        year = (shortYear >= 80 ? century - 100 + shortYear : century + shortYear).toString();
                    }
                    return `${year}-${month}-${day}`;
                }
            }
            
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                const day = d.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    }

    async loadClinicalPanel(pacienteId, pacienteName, epsName, epsNit) {
        this.currentPatientId = pacienteId;
        this.currentPatientName = pacienteName;

        // Switch to clinical panel view
        this.ui.switchView('clinical-panel');

        // Reset sidebar active tab to overview
        $('#clinical-sidebar-menu .nav-link').removeClass('active');
        $('#clinical-sidebar-menu .nav-link[data-tab="overview"]').addClass('active');
        $('.clinical-tab-content').addClass('d-none');
        $('#tab-overview').removeClass('d-none');

        // Show patient active care navigation button in navbar
        $('.btn-nav-atencion').removeClass('d-none');

        // Set doctor name in uniform navbar from session
        const user = this.storage.getUser();
        if (user) {
            let doctorName = $('#greet-doctor-name').text().replace('Dr. ', '').trim() || user.name;
            $('#panel-medico-name').text(doctorName);
        }

        // Set patient basic info in sidebar and workspace header
        $('#sidebar-patient-name').text(`${pacienteName}, --`);
        $('#sidebar-patient-id').text(pacienteId);
        $('#panel-patient-title-name').text(`Patient Overview - ${pacienteName}`);

        // Set loading states
        if ($('#panel-timeline-container').length > 0) {
            $('#panel-timeline-container').html('<div class="text-muted fs-8 text-center py-3"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando histórico...</div>');
        }

        // Reset inputs and values
        if ($('#form-evolucion-diaria')[0]) $('#form-evolucion-diaria')[0].reset();
        $('#selected-cie10-code').text('CIE-10');
        $('#selected-cie10-description').text('Ningún diagnóstico seleccionado');
        $('#evo_diagnostico').val('');
        $('.vital-input-card').removeClass('vital-alert-danger vital-alert-warning vital-alert-success');

        try {
            // Load Patient demographics (gender, birthdate) and calculate age
            const pPatient = this.api.request(`getPatient.php?id=${pacienteId}`, 'GET').catch(err => ({ error: true, message: err.message }));
            
            // Load historical consultations (encounters / evolutions) if timeline element exists
            const pTimeline = $('#panel-timeline-container').length > 0
                ? this.api.request(`getHistoriaClinica.php?id_pcnte=${pacienteId}`, 'GET').catch(err => ({ error: true, data: [] }))
                : Promise.resolve({ data: [] });

            const [resPatient, resTimeline] = await Promise.all([
                pPatient, pTimeline, this.loadPatientHistory(pacienteId)
            ]);

            // 1. Process Patient summary line and sidebar details card
            let genderText = 'N/A';
            let ageText = '-- años';
            let idType = 'CC';
            let idNumber = pacienteId;
            let patientFullName = pacienteName;

            if (resPatient && !resPatient.error && resPatient.status === 'success' && resPatient.data && resPatient.data.length > 0) {
                const patientObj = resPatient.data[0];
                
                // Build full name
                const nombres = [patientObj.primer_nombre, patientObj.segundo_nombre].filter(Boolean).join(' ');
                const apellidos = [patientObj.primer_apellido, patientObj.segundo_apellido].filter(Boolean).join(' ');
                patientFullName = [nombres, apellidos].filter(Boolean).join(' ') || pacienteName;

                // ID Details
                idType = patientObj.tipo_identificacion || 'CC';
                idNumber = patientObj.id_paciente || pacienteId;

                // Gender
                if (patientObj.sexo_nombre) {
                    genderText = patientObj.sexo_nombre;
                } else if (patientObj.genero_fhir) {
                    genderText = patientObj.genero_fhir === 'female' ? 'Femenino' : 'Masculino';
                }

                // Birthdate / Age
                const bDateStr = patientObj.fecha_nacimiento;
                if (bDateStr) {
                    const birth = new Date(bDateStr);
                    const today = new Date();
                    let age = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                        age--;
                    }
                    ageText = `${age} años`;
                }
            }
            
            // Set values to the sidebar Patient Profile & Title Header
            $('#sidebar-patient-name').text(patientFullName);
            $('#sidebar-patient-id').text(idNumber);
            $('#sidebar-patient-doc').text(`${idType} ${idNumber}`);
            $('#sidebar-patient-sex').text(genderText);
            $('#sidebar-patient-age').text(ageText);

            // Get occupation from resPatient
            let occupation = 'N/A';
            if (resPatient && !resPatient.error && resPatient.status === 'success' && resPatient.data && resPatient.data.length > 0) {
                occupation = resPatient.data[0].ocupacion || 'N/A';
            }
            $('#sidebar-patient-occupation').text(occupation).attr('title', occupation);
            $('#sidebar-patient-eps').text(epsName).attr('title', epsName);

            $('#panel-patient-title-name').text(`Patient Overview - ${patientFullName}`);

            // Dynamic patient avatar
            let avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'; // Alice Vance style female
            if (genderText.toLowerCase().includes('masculino') || genderText.toLowerCase().includes('male')) {
                avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'; // male
            }
            $('#sidebar-patient-avatar').attr('src', avatarUrl);
            
            // Update Smart Clinical Summary Card
            this.updateSmartClinicalSummary(ageText, genderText);

            // 5. Process Timeline & Latest Vital Signs (Only if container exists in DOM)
            const timelineContainer = $('#panel-timeline-container');
            if (timelineContainer.length > 0) {
                timelineContainer.empty();

                if (resTimeline && !resTimeline.error && resTimeline.data && resTimeline.data.length > 0) {
                    // Populate latest vital signs from the most recent entry
                    const sorted = resTimeline.data.sort((a,b) => parseInt(b.cnsctvo_pcnte) - parseInt(a.cnsctvo_pcnte));
                    const latest = sorted[0];

                    $('#prev-vital-ta').text(latest.prsion_artrial || '--');
                    $('#prev-vital-fc').text(latest.frcncia_crdca || '--');
                    $('#prev-vital-fr').text(latest.frcncia_rsprtria || '--');
                    $('#prev-vital-spo2').text(latest.plso || '--');
                    $('#prev-vital-temp').text(latest.tmprtra || '--');
                    $('#prev-vital-peso').text(latest.pso || '--');
                    $('#prev-vital-tlla').text(latest.tlla || '--');

                    // Set Vitals in left sidebar block
                    $('#sidebar-vital-bp').text(latest.prsion_artrial || '--');
                    $('#sidebar-vital-hr').text(latest.frcncia_crdca || '--');
                    $('#sidebar-vital-temp').text(latest.tmprtra ? `${parseFloat(latest.tmprtra).toFixed(1)}C` : '--');

                    // Render Timeline Feed (MEDNET Mockup Style)
                    const timelineFeed = $('<div class="timeline-mock-feed"></div>');
                    sorted.forEach((item, index) => {
                        const isLatest = index === 0;
                        const dateFormatted = this.formatMockupDate(item.fcha_aprtra);
                        
                        timelineFeed.append(`
                            <div class="timeline-mock-item">
                                <div class="timeline-mock-date-pill ${isLatest ? 'latest' : 'past'}">
                                    ${dateFormatted}
                                </div>
                                <div class="timeline-mock-node ${isLatest ? 'latest' : ''}"></div>
                                <div class="timeline-mock-card">
                                    <div class="timeline-mock-header">
                                        Visit: ${item.mtvo || 'Consulta General'}, Diagnosis: ${item.diagnostico_definitivo || 'Pendiente'}
                                    </div>
                                    <div class="timeline-mock-note">
                                        Dr. ${item.id_mdco || 'Médico'}: "${item.evlcion || 'Sin observaciones.'}"
                                    </div>
                                </div>
                            </div>
                        `);
                    });
                    timelineContainer.append(timelineFeed);
                } else {
                    // Reset vital signs text hints
                    $('#prev-vital-ta').text('--');
                    $('#prev-vital-fc').text('--');
                    $('#prev-vital-fr').text('--');
                    $('#prev-vital-spo2').text('--');
                    $('#prev-vital-temp').text('--');
                    $('#prev-vital-peso').text('--');
                    $('#prev-vital-tlla').text('--');

                    // Reset sidebar vitals
                    $('#sidebar-vital-bp').text('--');
                    $('#sidebar-vital-hr').text('--');
                    $('#sidebar-vital-temp').text('--');

                    timelineContainer.html('<div class="text-muted fs-8 text-center py-3">No hay historial de atenciones clínicas.</div>');
                }
            }

        } catch (error) {
            console.error("Error al cargar el panel clínico:", error);
            this.ui.showToast('Ocurrió un error al obtener datos clínicos del paciente.', 'danger');
        }
    }

    firmarEvolucion(event) {
        event.preventDefault();
        const pacienteId = this.currentPatientId;
        if (!pacienteId) return;

        this.executeFormAction('#form-evolucion-diaria', '#view-clinical-panel', async () => {
            const diagnostico = $('#evo_diagnostico').length > 0 ? $('#evo_diagnostico').val() : null;
            const user = this.storage.getUser();
            const payload = {
                id_pcnte: pacienteId,
                mtvo: $('#evo_motivo').length > 0 && $('#evo_motivo').val() ? $('#evo_motivo').val().trim() : null,
                evlcion: $('#evo_evlcion').length > 0 && $('#evo_evlcion').val() ? $('#evo_evlcion').val().trim() : null,
                pso: ($('#evo_pso').length > 0 && $('#evo_pso').val()) ? $('#evo_pso').val().toString() : null,
                tlla: ($('#evo_tlla').length > 0 && $('#evo_tlla').val()) ? parseFloat($('#evo_tlla').val()) : null,
                indce_msa_crpral: ($('#evo_imc').length > 0 && $('#evo_imc').val()) ? parseFloat($('#evo_imc').val()) : null,
                tmprtra: ($('#evo_tmprtra').length > 0 && $('#evo_tmprtra').val()) ? parseFloat($('#evo_tmprtra').val()) : null,
                prsion_artrial: ($('#evo_prsion').length > 0 && $('#evo_prsion').val()) ? $('#evo_prsion').val().trim() : null,
                frcncia_crdca: ($('#evo_frcncia_crdca').length > 0 && $('#evo_frcncia_crdca').val()) ? parseInt($('#evo_frcncia_crdca').val(), 10) : null,
                frcncia_rsprtria: ($('#evo_frcncia_rsprtria').length > 0 && $('#evo_frcncia_rsprtria').val()) ? parseInt($('#evo_frcncia_rsprtria').val(), 10) : null,
                plso: ($('#evo_plso').length > 0 && $('#evo_plso').val()) ? parseInt($('#evo_plso').val(), 10) : null,
                diagnostico_definitivo: diagnostico,
                observaciones: $('#evo_plan').length > 0 && $('#evo_plan').val() ? $('#evo_plan').val().trim() : null,
                id_mdco: user ? user.id : null,
                usuario_ingreso: user ? user.id : 'API'
            };

            const response = await this.api.request('createHistoriaClinica.php', 'POST', payload);
            if (response.status === 'success') {
                this.ui.showToast('Evolución clínica firmada e interoperada exitosamente.', 'success');
                
                // Limpiar borrador de localStorage
                localStorage.removeItem(`draft_patient_${pacienteId}`);
                
                // Limpiar formulario
                $('#form-evolucion-diaria')[0].reset();
                $('#selected-cie10-code').text('CIE-10');
                $('#selected-cie10-description').text('Ningún diagnóstico seleccionado');
                $('#evo_diagnostico').val('');

                // Redirigir al dashboard y recargar agenda
                await this.loadDashboardData();
                this.ui.switchView('dashboard');
            } else {
                throw new Error(response.message || 'Error al guardar la evolución.');
            }
        });
    }

}

// =========================================================================
// 5. COORDINATOR / APP ENTRY POINT
// =========================================================================
const CIE10_DICTIONARY = [
    { code: 'I10', desc: 'Hipertensión esencial (primaria)' },
    { code: 'E11', desc: 'Diabetes mellitus no insulinodependiente' },
    { code: 'J45', desc: 'Asma' },
    { code: 'K21', desc: 'Enfermedad por reflujo gastroesofágico' },
    { code: 'M54', desc: 'Dorsalgia' },
    { code: 'J00', desc: 'Rinofaringitis aguda (resfriado común)' },
    { code: 'U07.1', desc: 'COVID-19, virus identificado' },
    { code: 'N39.0', desc: 'Infección de vías urinarias, sitio no especificado' },
    { code: 'K29', desc: 'Gastritis y duodenitis' },
    { code: 'R51', desc: 'Cefalea' },
    { code: 'E66', desc: 'Obesidad' },
    { code: 'M25.5', desc: 'Dolor en articulación' },
    { code: 'F41.1', desc: 'Ansiedad generalizada' },
    { code: 'F32', desc: 'Episodio depresivo' },
    { code: 'J20', desc: 'Bronquitis aguda' },
    { code: 'H10', desc: 'Conjuntivitis' },
    { code: 'L20', desc: 'Dermatitis atópica' },
    { code: 'B35', desc: 'Dermatofitosis' },
    { code: 'R10', desc: 'Dolor abdominal y pélvico' },
    { code: 'G43', desc: 'Migraña' },
    { code: 'E78', desc: 'Trastornos del metabolismo de las lipoproteínas (Dislipidemia)' },
    { code: 'M79.7', desc: 'Fibromialgia' },
    { code: 'I25', desc: 'Enfermedad isquémica crónica del corazón' },
    { code: 'E03.9', desc: 'Hipotiroidismo, no especificado' },
    { code: 'J30', desc: 'Rinitis alérgica y vasomotora' },
    { code: 'A09', desc: 'Diarrea y gastroenteritis de presunto origen infeccioso' },
    { code: 'K59.0', desc: 'Estreñimiento' },
    { code: 'N18', desc: 'Enfermedad renal crónica' },
    { code: 'D64', desc: 'Otras anemias' },
    { code: 'K52', desc: 'Otras gastroenteritis y colitis no infecciosas' },
    { code: 'M17', desc: 'Gonartrosis (artrosis de la rodilla)' },
    { code: 'M16', desc: 'Coxartrosis (artrosis de la cadera)' },
    { code: 'J44', desc: 'Otras enfermedades pulmonares obstructivas crónicas (EPOC)' },
    { code: 'T14', desc: 'Traumatismo de región no especificada del cuerpo' },
    { code: 'L23', desc: 'Dermatitis alérgica de contacto' },
    { code: 'M81', desc: 'Osteoporosis sin fractura patológica' },
    { code: 'N40', desc: 'Hiperplasia de la próstata' },
    { code: 'R50', desc: 'Fiebre de origen desconocido' },
    { code: 'R05', desc: 'Tos' },
    { code: 'R07', desc: 'Dolor en el pecho' },
    { code: 'R42', desc: 'Devaneo y alteración del equilibrio (Vértigo)' },
    { code: 'G47', desc: 'Trastornos del sueño (Insomnio)' },
    { code: 'Z00.0', desc: 'Examen médico general' },
    { code: 'Z01.2', desc: 'Examen odontológico' }
];

class App {
    constructor() {
        this.storage = new StorageService();
        this.api = new ApiService(this.storage);
        this.ui = new UiService();
        this.formHandler = new FormHandler(this.api, this.ui, this.storage);
    }

    init() {
        this.bindEvents();
        this.evaluateRouting();
    }

    bindEvents() {
        // Enlazar submits de los formularios
        $('#form-login').on('submit', (e) => this.formHandler.login(e));
        $('#form-change-password').on('submit', (e) => this.formHandler.changePassword(e));
        $('#form-patologico').on('submit', (e) => this.formHandler.savePatologico(e));
        $('#form-alergico').on('submit', (e) => this.formHandler.saveAlergico(e));
        $('#form-familiar').on('submit', (e) => this.formHandler.saveFamiliar(e));
        $('#form-farmaco').on('submit', (e) => this.formHandler.saveFarmaco(e));

        // Botón Cierre de Sesión
        $('#btn-logout, #btn-logout-panel').on('click', (e) => {
            e.preventDefault();
            this.storage.clearSession();
            this.formHandler.currentPatientId = null;
            this.formHandler.currentPatientName = null;
            $('.btn-nav-atencion').addClass('d-none');
            this.ui.showToast('Sesión cerrada correctamente.', 'info');
            this.ui.switchView('login');
            $('#form-login')[0].reset();
        });

        // Enlace desde Login a Cambio de Contraseña Voluntario
        $('#link-to-change-password').on('click', (e) => {
            e.preventDefault();
            $('#form-change-password')[0].reset();
            $('#change_username').prop('readonly', false).val('');
            $('.lock-banner').addClass('d-none');
            $('#group-back-to-login').removeClass('d-none');
            this.ui.switchView('change-password');
        });

        // Enlace Volver al Login
        $('#link-back-to-login').on('click', (e) => {
            e.preventDefault();
            this.ui.switchView('login');
        });

        // Botón actualizar agenda
        $(document).on('click', '#btn-refresh-agenda', (e) => {
            e.preventDefault();
            const user = this.storage.getUser();
            if (user) {
                this.formHandler.loadPatientAgenda(user.id);
            }
        });

        // Botón Atender Cita (Apertura del Panel de Atención Clínica - Split Screen)
        $(document).on('click', '.btn-atender', async (e) => {
            e.stopPropagation(); // Evitar disparar el click de la fila
            
            const clickedButton = $(e.currentTarget);
            const pacienteId = clickedButton.data('id');
            const pacienteName = clickedButton.data('name');

            // Obtener datos de aseguradora/EPS de la fila
            const row = clickedButton.closest('tr');
            const epsName = row.find('td:nth-child(5) .fw-medium').text().trim() || 'N/A';
            const epsNit = row.find('td:nth-child(5) .font-monospace').text().replace('NIT: ', '').trim() || 'N/A';

            // Cargar panel
            await this.formHandler.loadClinicalPanel(pacienteId, pacienteName, epsName, epsNit);
        });

        // Volver al Dashboard desde el menú (visible en todas las páginas)
        $(document).on('click', '.btn-nav-dashboard', (e) => {
            e.preventDefault();
            this.ui.switchView('dashboard');
        });

        // Copiar medicamento a la consulta actual
        $(document).on('click', '.btn-copy-med', function(e) {
            e.preventDefault();
            const medText = $(this).data('med');
            const currentVal = $('#evo_plan').val().trim();
            if (currentVal) {
                $('#evo_plan').val(currentVal + '\n- ' + medText);
            } else {
                $('#evo_plan').val('- ' + medText);
            }
            // Animate effect
            $(this).removeClass('btn-sky-outline').addClass('btn-success text-white').html('<i class="bi bi-check"></i> Copiado');
            setTimeout(() => {
                $(this).removeClass('btn-success text-white').addClass('btn-sky-outline').html('<i class="bi bi-copy"></i> Copiar');
            }, 1000);
        });

        // Cálculo dinámico de IMC
        $('#evo_pso, #evo_tlla').on('input', () => {
            const peso = parseFloat($('#evo_pso').val());
            const talla = parseFloat($('#evo_tlla').val()) / 100; // a metros
            if (peso > 0 && talla > 0) {
                const imc = peso / (talla * talla);
                $('#evo_imc').val(imc.toFixed(1));
            } else {
                $('#evo_imc').val('');
            }
        });

        // Diagnóstico CIE-10 autocomplete search
        $('#search-cie10-input').on('input', function() {
            const query = $(this).val().trim().toLowerCase();
            const dropdown = $('#search-cie10-dropdown');
            dropdown.empty();

            if (!query) {
                dropdown.addClass('d-none');
                return;
            }

            const filtered = CIE10_DICTIONARY.filter(item => 
                item.code.toLowerCase().includes(query) || 
                item.desc.toLowerCase().includes(query)
            );

            if (filtered.length > 0) {
                filtered.forEach(item => {
                    dropdown.append(`
                        <button type="button" class="list-group-item list-group-item-action cie10-item text-start" data-code="${item.code}" data-desc="${item.desc}">
                            <strong>${item.code}</strong> - ${item.desc}
                        </button>
                    `);
                });
                dropdown.removeClass('d-none');
            } else {
                dropdown.append('<div class="list-group-item text-muted text-center fs-8">Sin resultados</div>');
                dropdown.removeClass('d-none');
            }
        });

        // Selección de diagnóstico
        $(document).on('click', '.cie10-item', function(e) {
            e.preventDefault();
            const code = $(this).data('code');
            const desc = $(this).data('desc');

            $('#selected-cie10-code').text(code);
            $('#selected-cie10-description').text(desc);
            $('#evo_diagnostico').val('CIE10-' + code);
            
            $('#search-cie10-input').val('');
            $('#search-cie10-dropdown').addClass('d-none');
        });

        // Ocultar dropdown al hacer clic fuera
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#search-cie10-input, #search-cie10-dropdown').length) {
                $('#search-cie10-dropdown').addClass('d-none');
            }
        });



        // Formulario de Evolución Diaria (Firmar y Evolucionar)
        $('#form-evolucion-diaria').on('submit', (e) => this.formHandler.firmarEvolucion(e));

        // Botón de navegación "Atención Activa"
        $(document).on('click', '.btn-nav-atencion', (e) => {
            e.preventDefault();
            const activeId = this.formHandler.currentPatientId;
            if (activeId) {
                this.ui.switchView('clinical-panel');
            }
        });

        // Alertas dinámicas de signos vitales (Temperatura)
        $('#evo_tmprtra').on('input', function() {
            const val = parseFloat($(this).val());
            const card = $(this).closest('.vital-input-card');
            card.removeClass('vital-alert-danger vital-alert-warning vital-alert-success');
            if (!isNaN(val)) {
                if (val < 35.0 || val > 38.0) {
                    card.addClass('vital-alert-danger');
                } else if ((val >= 35.0 && val <= 35.9) || (val >= 37.6 && val <= 38.0)) {
                    card.addClass('vital-alert-warning');
                } else {
                    card.addClass('vital-alert-success');
                }
            }
        });

        // Alertas dinámicas de signos vitales (SPO2 / Oxígeno)
        $('#evo_plso').on('input', function() {
            const val = parseFloat($(this).val());
            const card = $(this).closest('.vital-input-card');
            card.removeClass('vital-alert-danger vital-alert-warning vital-alert-success');
            if (!isNaN(val)) {
                if (val < 90) {
                    card.addClass('vital-alert-danger');
                } else if (val >= 90 && val <= 94) {
                    card.addClass('vital-alert-warning');
                } else {
                    card.addClass('vital-alert-success');
                }
            }
        });

        // Cambio de pestaña en el menú lateral (Mockup Tab View)
        $(document).on('click', '.btn-sidebar-tab', (e) => {
            e.preventDefault();
            const tabId = $(e.currentTarget).data('tab');
            
            if (tabId === 'patients') {
                // Volver al Dashboard
                this.ui.switchView('dashboard');
                return;
            }

            // Cambiar pestaña activa en el menú
            $('#clinical-sidebar-menu .nav-link').removeClass('active');
            $(e.currentTarget).addClass('active');

            // Mostrar la sección correspondiente
            $('.clinical-tab-content').addClass('d-none');
            $(`#tab-${tabId}`).removeClass('d-none');
        });

    }

    evaluateRouting() {
        const token = this.storage.getToken();
        const user = this.storage.getUser();

        if (token && user) {
            // Si hay sesión activa
            const requiresChange = this.storage.getRequirePasswordChange();
            if (requiresChange) {
                // Redirección obligatoria al cambio de contraseña
                this.ui.showToast('Debe cambiar la contraseña inicial obligatoriamente.', 'info');
                
                // Configurar formulario de cambio de clave como obligatorio y bloqueado
                $('#change_username').val(user.id).prop('readonly', true);
                $('.lock-banner').removeClass('d-none');
                $('#group-back-to-login').addClass('d-none');
                
                this.ui.switchView('change-password');
            } else {
                // Acceso libre al Dashboard
                this.formHandler.loadDashboardData();
                this.ui.switchView('dashboard');
            }
        } else {
            // Si no hay sesión, siempre mostrar Login
            this.ui.switchView('login');
        }
    }
}

// Inicializar el portal al estar listo el DOM
$(document).ready(() => {
    const portal = new App();
    portal.init();
});
