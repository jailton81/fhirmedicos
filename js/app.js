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

    /**
     * Renders and displays a premium Bootstrap Modal showing the raw FHIR JSON bundle.
     * @param {object} bundleJson - MAPPED FHIR bundle
     */
    /**
     * Renders and displays a premium Bootstrap Modal showing the raw FHIR JSON bundle,
     * the response from get_datos_tokenizar, the response from URL_GET_TOKEN_RDA, and the response from URL_SEND_FHIR.
     * @param {object} bundleJson - MAPPED FHIR bundle
     * @param {object} tokenizarJson - Response from get_datos_tokenizar.php
     * @param {object} rdaTokenJson - Response from URL_GET_TOKEN_RDA webservice
     * @param {object} sendFhirResponse - Response from URL_SEND_FHIR webservice
     */
    showFhirResourceModal(bundleJson, tokenizarJson = null, rdaTokenJson = null, sendFhirResponse = null) {
        $('#fhir-bundle-modal').remove();

        const modalHtml = `
            <div class="modal fade" id="fhir-bundle-modal" tabindex="-1" aria-labelledby="fhirBundleModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 12px; overflow: hidden;">
                        <div class="modal-header bg-dark text-white border-0 py-3">
                            <h5 class="modal-title fs-6 fw-bold" id="fhirBundleModalLabel">
                                <i class="bi bi-filetype-json text-info me-2"></i>Recursos Generados y Respuestas de Integración
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body bg-light p-4">
                            <ul class="nav nav-pills mb-3 gap-2" id="json-modal-tabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active fw-bold text-dark border-0 rounded-pill px-3 py-1.5 fs-8" id="fhir-tab" data-bs-toggle="tab" data-bs-target="#fhir-panel" type="button" role="tab" aria-controls="fhir-panel" aria-selected="true">
                                        <i class="bi bi-file-earmark-code text-primary me-1"></i>JSON FHIR (RDA)
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link fw-bold text-dark border-0 rounded-pill px-3 py-1.5 fs-8" id="tokenizar-tab" data-bs-toggle="tab" data-bs-target="#tokenizar-panel" type="button" role="tab" aria-controls="tokenizar-panel" aria-selected="false">
                                        <i class="bi bi-shield-lock text-success me-1"></i>Respuesta Tokenizar
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link fw-bold text-dark border-0 rounded-pill px-3 py-1.5 fs-8" id="rda-token-tab" data-bs-toggle="tab" data-bs-target="#rda-token-panel" type="button" role="tab" aria-controls="rda-token-panel" aria-selected="false">
                                        <i class="bi bi-key text-warning me-1"></i>Token RDA
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link fw-bold text-dark border-0 rounded-pill px-3 py-1.5 fs-8" id="send-fhir-tab" data-bs-toggle="tab" data-bs-target="#send-fhir-panel" type="button" role="tab" aria-controls="send-fhir-panel" aria-selected="false">
                                        <i class="bi bi-cloud-arrow-up text-danger me-1"></i>Respuesta Envío FHIR
                                    </button>
                                </li>
                            </ul>
                            <div class="tab-content" id="json-modal-tab-content">
                                <div class="tab-pane fade show active" id="fhir-panel" role="tabpanel" aria-labelledby="fhir-tab">
                                    <p class="text-secondary small mb-3">
                                        Este es el recurso **FHIR Bundle (type: document)** generado para el Resumen Digital de Atención (RDA):
                                    </p>
                                    <div class="fhir-resource-viewer position-relative rounded shadow-sm overflow-hidden" style="background: #1e1e1e;">
                                        <pre class="mb-0 p-3" style="max-height: 400px; overflow-y: auto;"><code class="language-json" id="fhir-json-block" style="color: #abb2bf; font-family: monospace; font-size: 0.8rem; display: block;">${JSON.stringify(bundleJson, null, 2)}</code></pre>
                                        <button class="btn btn-sm btn-sky position-absolute top-0 end-0 m-3 px-3 py-1 fs-9" id="btn-copy-fhir-json">
                                            <i class="bi bi-clipboard me-1"></i>Copiar
                                        </button>
                                    </div>
                                </div>
                                <div class="tab-pane fade" id="tokenizar-panel" role="tabpanel" aria-labelledby="tokenizar-tab">
                                    <p class="text-secondary small mb-3">
                                        Respuesta obtenida del endpoint de tokenización (**get_datos_tokenizar.php**):
                                    </p>
                                    <div class="fhir-resource-viewer position-relative rounded shadow-sm overflow-hidden" style="background: #1e1e1e;">
                                        <pre class="mb-0 p-3" style="max-height: 400px; overflow-y: auto;"><code class="language-json" id="tokenizar-json-block" style="color: #abb2bf; font-family: monospace; font-size: 0.8rem; display: block;">${tokenizarJson ? JSON.stringify(tokenizarJson, null, 2) : 'No se pudo obtener la respuesta de tokenización o no hay datos.'}</code></pre>
                                        <button class="btn btn-sm btn-sky position-absolute top-0 end-0 m-3 px-3 py-1 fs-9" id="btn-copy-tokenizar-json">
                                            <i class="bi bi-clipboard me-1"></i>Copiar
                                        </button>
                                    </div>
                                </div>
                                <div class="tab-pane fade" id="rda-token-panel" role="tabpanel" aria-labelledby="rda-token-tab">
                                    <p class="text-secondary small mb-3">
                                        Respuesta obtenida del webservice de autenticación RDA (**URL_GET_TOKEN_RDA**):
                                    </p>
                                    <div class="fhir-resource-viewer position-relative rounded shadow-sm overflow-hidden" style="background: #1e1e1e;">
                                        <pre class="mb-0 p-3" style="max-height: 400px; overflow-y: auto;"><code class="language-json" id="rda-token-json-block" style="color: #abb2bf; font-family: monospace; font-size: 0.8rem; display: block;">${rdaTokenJson ? JSON.stringify(rdaTokenJson, null, 2) : 'No se pudo obtener la respuesta del webservice RDA.'}</code></pre>
                                        <button class="btn btn-sm btn-sky position-absolute top-0 end-0 m-3 px-3 py-1 fs-9" id="btn-copy-rda-token-json">
                                            <i class="bi bi-clipboard me-1"></i>Copiar
                                        </button>
                                    </div>
                                </div>
                                <div class="tab-pane fade" id="send-fhir-panel" role="tabpanel" aria-labelledby="send-fhir-tab">
                                    <p class="text-secondary small mb-3">
                                        Respuesta obtenida del webservice al enviar el JSON FHIR (**URL_SEND_FHIR + $enviar-rda-paciente**):
                                    </p>
                                    <div class="fhir-resource-viewer position-relative rounded shadow-sm overflow-hidden" style="background: #1e1e1e;">
                                        <pre class="mb-0 p-3" style="max-height: 400px; overflow-y: auto;"><code class="language-json" id="send-fhir-json-block" style="color: #abb2bf; font-family: monospace; font-size: 0.8rem; display: block;">${sendFhirResponse ? JSON.stringify(sendFhirResponse, null, 2) : 'No se pudo obtener la respuesta del envío FHIR.'}</code></pre>
                                        <button class="btn btn-sm btn-sky position-absolute top-0 end-0 m-3 px-3 py-1 fs-9" id="btn-copy-send-fhir-json">
                                            <i class="bi bi-clipboard me-1"></i>Copiar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer bg-white border-top-0 py-3">
                            <button type="button" class="btn btn-sm btn-secondary px-3 py-1.5 fs-8" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);

        // Custom style overrides for pills active state
        $('<style>')
            .prop('type', 'text/css')
            .html(`
                #json-modal-tabs .nav-link { background-color: #f1f3f5; }
                #json-modal-tabs .nav-link.active { background-color: #e9ecef !important; border-bottom: 2px solid #007bff !important; border-radius: 20px !important; }
            `)
            .appendTo('head');

        // Bind copy button events
        $('#btn-copy-fhir-json').on('click', function() {
            const textToCopy = $('#fhir-json-block').text();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const $btn = $(this);
                $btn.removeClass('btn-sky').addClass('btn-success text-white').html('<i class="bi bi-check2"></i> Copiado');
                setTimeout(() => {
                    $btn.removeClass('btn-success text-white').addClass('btn-sky').html('<i class="bi bi-clipboard me-1"></i>Copiar');
                }, 1500);
            }).catch(err => {
                console.error("Failed to copy text: ", err);
            });
        });

        $('#btn-copy-tokenizar-json').on('click', function() {
            const textToCopy = $('#tokenizar-json-block').text();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const $btn = $(this);
                $btn.removeClass('btn-sky').addClass('btn-success text-white').html('<i class="bi bi-check2"></i> Copiado');
                setTimeout(() => {
                    $btn.removeClass('btn-success text-white').addClass('btn-sky').html('<i class="bi bi-clipboard me-1"></i>Copiar');
                }, 1500);
            }).catch(err => {
                console.error("Failed to copy text: ", err);
            });
        });

        $('#btn-copy-rda-token-json').on('click', function() {
            const textToCopy = $('#rda-token-json-block').text();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const $btn = $(this);
                $btn.removeClass('btn-sky').addClass('btn-success text-white').html('<i class="bi bi-check2"></i> Copiado');
                setTimeout(() => {
                    $btn.removeClass('btn-success text-white').addClass('btn-sky').html('<i class="bi bi-clipboard me-1"></i>Copiar');
                }, 1500);
            }).catch(err => {
                console.error("Failed to copy text: ", err);
            });
        });

        $('#btn-copy-send-fhir-json').on('click', function() {
            const textToCopy = $('#send-fhir-json-block').text();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const $btn = $(this);
                $btn.removeClass('btn-sky').addClass('btn-success text-white').html('<i class="bi bi-check2"></i> Copiado');
                setTimeout(() => {
                    $btn.removeClass('btn-success text-white').addClass('btn-sky').html('<i class="bi bi-clipboard me-1"></i>Copiar');
                }, 1500);
            }).catch(err => {
                console.error("Failed to copy text: ", err);
            });
        });

        const myModal = new bootstrap.Modal(document.getElementById('fhir-bundle-modal'));
        myModal.show();
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
        this.selectedDiagnoses = [];

        // Instanciar AntecedentesDrawer (Offcanvas)
        this.antecedentesDrawer = new AntecedentesDrawer({
            mountElement: document.body,
            onSave: async (resourceType, fhirResource) => {
                const pacienteId = this.currentPatientId;
                if (!pacienteId) return;
                
                try {
                    let endpoint = '';
                    let payload = { id_pcnte: pacienteId };

                    if (resourceType === 'Condition') {
                        endpoint = 'createCondition.php';
                        payload.descripcion = fhirResource.code.text;
                        payload.cie_10 = fhirResource.code.coding[0] ? fhirResource.code.coding[0].code : null;
                        payload.estado = fhirResource.clinicalStatus.coding[0].code;
                        payload.estado_verificacion = fhirResource.verificationStatus.coding[0].code;
                        payload.edad_diagnostico = fhirResource.onsetAge ? fhirResource.onsetAge.value : null;
                        payload.observaciones = fhirResource.note && fhirResource.note[0] ? fhirResource.note[0].text : null;
                    } 
                    else if (resourceType === 'MedicationStatement') {
                        endpoint = 'createMedicationStatement.php';
                        payload.descripcion = fhirResource.medicationCodeableConcept.text;
                        payload.estado = fhirResource.status;
                        payload.observaciones = fhirResource.dosage[0] ? fhirResource.dosage[0].text : null;
                        payload.codigo = fhirResource.medicationCodeableConcept.coding && fhirResource.medicationCodeableConcept.coding[0] ? fhirResource.medicationCodeableConcept.coding[0].code : null;
                    } 
                    else if (resourceType === 'FamilyMemberHistory') {
                        endpoint = 'createFamilyMemberHistory.php';
                        payload.descripcion = fhirResource.condition[0].code.text;
                        // Traducir parentesco FHIR a código de la BD (FTH/MTH -> 01, SIB -> 02, UNC -> 03, GRFTH -> 04)
                        const mapping = { 'FTH': '01', 'MTH': '01', 'SIB': '02', 'UNC': '03', 'GRFTH': '04' };
                        const relCode = fhirResource.relationship.coding[0].code;
                        payload.parentesco = mapping[relCode] || relCode || '01';
                        payload.estado = fhirResource.status;
                        payload.codigo = fhirResource.condition[0].code.coding && fhirResource.condition[0].code.coding[0] ? fhirResource.condition[0].code.coding[0].code : null;
                        payload.cie_10 = payload.codigo;
                        payload.edad_diagnostico = fhirResource.condition[0].onsetAge ? fhirResource.condition[0].onsetAge.value : null;
                        payload.observaciones = fhirResource.condition[0].note && fhirResource.condition[0].note[0] ? fhirResource.condition[0].note[0].text : null;
                    } 
                    else if (resourceType === 'AllergyIntolerance') {
                        endpoint = 'createAllergyIntolerance.php';
                        payload.descripcion = fhirResource.code.text;
                        payload.tipoalergia = fhirResource.type;
                        payload.estado = fhirResource.clinicalStatus.coding[0].code;
                        payload.estado_verificacion = fhirResource.verificationStatus.coding[0].code;
                        payload.criticidad = fhirResource.criticality;
                        payload.observaciones = fhirResource.note && fhirResource.note[0] ? fhirResource.note[0].text : null;
                    }
                    else if (resourceType === 'Observation') {
                        endpoint = 'createAntecedenteOtro.php';
                        payload.quirurgicos = fhirResource.component.find(c => c.code.text === 'Quirurgicos')?.valueString || null;
                        payload.transfusiones = fhirResource.component.find(c => c.code.text === 'Transfusiones')?.valueString || null;
                        payload.traumaticos = fhirResource.component.find(c => c.code.text === 'Traumaticos')?.valueString || null;
                        payload.toxicos = fhirResource.component.find(c => c.code.text === 'Toxicos')?.valueString || null;
                        payload.ets = fhirResource.component.find(c => c.code.text === 'ETS')?.valueString || null;
                        payload.ginecoobstetras = fhirResource.component.find(c => c.code.text === 'Ginecoobstetras')?.valueString || null;
                    }

                    if (endpoint) {
                        const response = await this.api.request(endpoint, 'POST', payload);
                        if (response.status === 'success') {
                            this.ui.showToast('Antecedente guardado y sincronizado exitosamente.', 'success');
                            
                            // Recargar las listas del panel principal
                            if (resourceType === 'Condition') await this.loadConditions(pacienteId);
                            else if (resourceType === 'MedicationStatement') await this.loadMedications(pacienteId);
                            else if (resourceType === 'FamilyMemberHistory') await this.loadFamilyHistory(pacienteId);
                            else if (resourceType === 'AllergyIntolerance') await this.loadAllergies(pacienteId);
                            else if (resourceType === 'Observation') await this.loadOtros(pacienteId);
                            
                            this.updateSmartClinicalSummary($('#sidebar-patient-age').text(), $('#sidebar-patient-sex').text());
                            return true;
                        } else {
                            this.ui.showToast(`Error al guardar en el servidor: ${response.message}`, 'danger');
                            return false;
                        }
                    }
                    return false;
                } catch (error) {
                    console.error("Error in Offcanvas onSave synchronization:", error);
                    this.ui.showToast('Error de comunicación al sincronizar con el servidor.', 'danger');
                    return false;
                }
            }
        });
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

    renderSelectedDiagnoses() {
        const tbody = $('#list-diagnosticos-seleccionados');
        if (!tbody.length) return;
        tbody.empty();

        if (!this.selectedDiagnoses || this.selectedDiagnoses.length === 0) {
            tbody.append(`
                <tr id="row-no-diagnoses">
                    <td colspan="4" class="text-muted text-center py-3 italic">Ningún diagnóstico seleccionado aún.</td>
                </tr>
            `);
            return;
        }

        this.selectedDiagnoses.forEach((item, index) => {
            const priorityText = item.indicador === 'principal' ? 'Principal' : 'Relacionado';
            const typeText = item.tipo === 'impresion_diagnostica' ? 'Impresión Diagnóstica' : 'Confirmado';
            
            tbody.append(`
                <tr>
                    <td class="ps-3 font-monospace fw-bold text-secondary">${item.code}</td>
                    <td class="text-dark fw-medium">${item.display}</td>
                    <td>
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1" style="font-size: 0.75rem;">${priorityText}</span>
                        <span class="badge bg-info-subtle text-info border border-info-subtle" style="font-size: 0.75rem;">${typeText}</span>
                    </td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-link text-danger py-0 btn-delete-diag" data-index="${index}" title="Eliminar diagnóstico" style="box-shadow: none;">
                            <i class="bi bi-trash fs-6"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    addDiagnosis(code, display) {
        const indicator = $('#evo_indicador_diagnostico').val() || 'principal';
        const tipo = $('#evo_tipo_diagnostico').val() || 'impresion_diagnostica';

        // Check if already exists
        if (this.selectedDiagnoses.some(d => d.code === code)) {
            this.ui.showToast(`El diagnóstico ${code} ya está seleccionado.`, 'warning');
            return;
        }

        // If trying to add a second 'principal' diagnosis, show warning
        if (indicator === 'principal' && this.selectedDiagnoses.some(d => d.indicador === 'principal')) {
            this.ui.showToast('Nota: Ya existe un diagnóstico principal seleccionado.', 'info');
        }

        this.selectedDiagnoses.push({
            code: code,
            display: display,
            indicador: indicator,
            tipo: tipo
        });

        this.renderSelectedDiagnoses();
    }

    removeDiagnosis(index) {
        this.selectedDiagnoses.splice(index, 1);
        this.renderSelectedDiagnoses();
    }

    async loadPatientHistory(pacienteId) {
        this.selectedDiagnoses = [];
        this.renderSelectedDiagnoses();

        // Show loading status in the sidebar cards and panel containers
        $('#list-patologicos-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-alergicos-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-familiares-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-farmacos-existentes').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');
        $('#list-diagnosticos-activos').html('<div class="text-muted fs-8.5 text-center py-1"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando...</div>');

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
        const pDiagnoses = this.loadDiagnosticosHC(pacienteId);
        const pStatusOpts = this.loadStatusOptions();
        const pOtros = this.loadOtros(pacienteId);

        await Promise.all([pCondition, pAllergy, pFamily, pMedication, pDiagnoses, pStatusOpts, pOtros]);

        // Mapear y actualizar datos del Drawer de Antecedentes (Offcanvas)
        const conditionsMapped = (this.currentConditions || []).map(c => ({
            id: c.id,
            code: c.cie_10 || 'S/C',
            description: c.descripcion || '',
            clinicalStatus: c.status_clinico_code || 'active',
            verificationStatus: c.status_verificacion_code || c.verificacion_code || 'confirmed',
            recordedDate: c.fcha_aprtra ? c.fcha_aprtra.split(' ')[0] : '--',
            edad: c.edad_diagnostico || null,
            observaciones: c.observaciones || null
        }));

        const medicationsMapped = (this.currentMedications || []).map(m => ({
            id: m.id,
            medication: m.descripcion || '',
            status: m.estado || 'active',
            dosage: m.observaciones || 'Sin especificaciones',
            effectiveDate: m.fcha_aprtra ? m.fcha_aprtra.split(' ')[0] : '--',
            code: m.codigo || 'S/C'
        }));

        const familyHistoryMapped = (this.currentFamilyHistory || []).map(f => ({
            id: f.id,
            relationship: f.parentesco_nombre || 'Familiar',
            condition: f.descripcion || '',
            status: f.estado || 'completed',
            code: f.cie_10 || f.codigo || 'S/C',
            edad: f.edad_diagnostico || null,
            observaciones: f.observaciones || null
        }));

        const allergiesMapped = (this.currentAllergies || []).map(a => ({
            id: a.id,
            substance: a.descripcion || '',
            criticality: a.criticidad || 'high',
            type: a.tipoalergia,
            tipo_alergia_nombre: a.tipo_alergia_nombre || 'Alergia',
            clinicalStatus: a.estado || 'active',
            estado_clinico_display: a.estado_clinico_display || 'Activo',
            verificationStatus: a.estado_verificacion || 'confirmed',
            verificacion_display: a.verificacion_display || 'Confirmado',
            observaciones: a.observaciones || ''
        }));

        this.antecedentesDrawer.setData({
            conditions: conditionsMapped,
            medications: medicationsMapped,
            familyHistory: familyHistoryMapped,
            allergies: allergiesMapped,
            otros: this.currentOtros
        });

        // Configurar el paciente activo en el drawer
        this.antecedentesDrawer.state.pacienteId = pacienteId;
        this.antecedentesDrawer.state.patientName = this.currentPatientName || '';
        if (this.antecedentesDrawer.drawerElement) {
            this.antecedentesDrawer.drawerElement.querySelector('#drawer-patient-id').textContent = pacienteId;
            this.antecedentesDrawer.drawerElement.querySelector('#drawer-patient-name').textContent = this.currentPatientName || '';
        }
    }

    async loadDiagnosticosHC(pacienteId) {
        try {
            const pDiag = this.api.request(`getDiagnosticoHC.php?id_pcnte=${pacienteId}`, 'GET').catch(err => ({ error: true, data: [] }));
            const pCond = this.api.request(`getCondition.php?id_pcnte=${pacienteId}`, 'GET').catch(err => ({ error: true, data: [] }));
            
            const [resDiag, resCond] = await Promise.all([pDiag, pCond]);
            const sideContainer = $('#list-diagnosticos-activos');
            sideContainer.empty();

            const allItems = [];

            if (resDiag && resDiag.status === 'success' && resDiag.data && resDiag.data.length > 0) {
                resDiag.data.forEach(item => {
                    allItems.push({
                        cie_10: item.cie_10,
                        codigo: item.codigo,
                        descripcion: item.descripcion,
                        estado: item.estado
                    });
                });
            }

            if (resCond && resCond.status === 'success' && resCond.data && resCond.data.length > 0) {
                resCond.data.forEach(item => {
                    allItems.push({
                        cie_10: item.cie_10,
                        codigo: item.codigo,
                        descripcion: item.descripcion,
                        estado: item.status_clinico_code || item.estado
                    });
                });
            }

            const unique = [];
            const seen = new Set();
            allItems.forEach(item => {
                const key = (item.cie_10 || item.codigo || item.descripcion || '').trim().toLowerCase();
                const isActive = (item.estado || '').trim().toLowerCase() === 'active';
                if (isActive && key && !seen.has(key)) {
                    seen.add(key);
                    unique.push(item);
                }
            });

            if (unique.length > 0) {
                unique.forEach(item => {
                    const displayCode = item.cie_10 || item.codigo || 'CIE-10';
                    const desc = item.descripcion || 'Sin descripción';
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 100%;">
                                <span class="badge bg-sky-pale text-primary border font-monospace me-1 fs-8">${displayCode}</span>
                                <span class="fw-medium text-dark" title="${desc}">${desc}</span>
                            </div>
                        </div>
                    `);
                });
            } else {
                sideContainer.html('<div class="text-muted fs-8.5 text-center py-1">Sin diagnósticos activos.</div>');
            }
        } catch (error) {
            console.error("Error al cargar diagnósticos:", error);
            $('#list-diagnosticos-activos').html('<div class="text-danger fs-8.5 text-center py-1">Error al cargar.</div>');
        }
    }

    async loadStatusOptions() {
        try {
            const pStatus = this.api.request('getEstados.php?status=ConditionClinicalStatusCodes', 'GET').catch(err => ({ error: true, data: [] }));
            const pAllergyStatus = this.api.request('getEstados.php?status=AllergyIntoleranceClinicalStatusCodes', 'GET').catch(err => ({ error: true, data: [] }));
            const pVerif = this.api.request('getEstados.php?status=verificationStatus', 'GET').catch(err => ({ error: true, data: [] }));
            const pMedStatus = this.api.request('getEstados.php?status=MedicationStatusCodes', 'GET').catch(err => ({ error: true, data: [] }));
            const pHistoryStatus = this.api.request('getEstados.php?status=history-status', 'GET').catch(err => ({ error: true, data: [] }));
            const pParentesco = this.api.request('getEstados.php?status=Parentesco', 'GET').catch(err => ({ error: true, data: [] }));
            const pTipoAlergia = this.api.request('getEstados.php?status=tipoalergia', 'GET').catch(err => ({ error: true, data: [] }));
            const pFrecStatus = this.api.request('getEstados.php?status=UnidadTiempo', 'GET').catch(err => ({ error: true, data: [] }));
            const pViaStatus = this.api.request('getEstados.php?status=VAD', 'GET').catch(err => ({ error: true, data: [] }));
            const pDosisStatus = this.api.request('getEstados.php?status=UMM', 'GET').catch(err => ({ error: true, data: [] }));
            const pTechStatus = this.api.request('getEstados.php?status=TipoTecnologiaSalud', 'GET').catch(err => ({ error: true, data: [] }));

            const [resStatus, resAllergyStatus, resVerif, resMedStatus, resHistoryStatus, resParentesco, resTipoAlergia, resFrecStatus, resViaStatus, resDosisStatus, resTechStatus] = await Promise.all([
                pStatus, pAllergyStatus, pVerif, pMedStatus, pHistoryStatus, pParentesco, pTipoAlergia, pFrecStatus, pViaStatus, pDosisStatus, pTechStatus
            ]);

            if (resParentesco && resParentesco.status === 'success' && resParentesco.data) {
                // Populate parentesco select in drawer
                if (this.antecedentesDrawer && this.antecedentesDrawer.drawerElement) {
                    const selectParentesco = this.antecedentesDrawer.drawerElement.querySelector('#form-familiares select[name="parentesco"]');
                    if (selectParentesco) {
                        selectParentesco.innerHTML = resParentesco.data.map(item => 
                            `<option value="${item.code}">${item.display}</option>`
                        ).join('');
                    }
                }
            }

            if (resTipoAlergia && resTipoAlergia.status === 'success' && resTipoAlergia.data) {
                // Populate tipoalergia select in drawer
                if (this.antecedentesDrawer && this.antecedentesDrawer.drawerElement) {
                    const selectTipoAlergia = this.antecedentesDrawer.drawerElement.querySelector('#form-alergias select[name="tipoalergia"]');
                    if (selectTipoAlergia) {
                        selectTipoAlergia.innerHTML = '<option value="" disabled selected>Seleccione...</option>' + 
                            resTipoAlergia.data.map(item => 
                                `<option value="${item.code}">${item.display}</option>`
                            ).join('');
                    }
                }
            }

            if (resStatus && resStatus.status === 'success' && resStatus.data) {
                // Populate pathological status
                const selectEstado = $('#pat_estado');
                selectEstado.empty();
                resStatus.data.forEach(item => {
                    selectEstado.append(new Option(item.display, item.code));
                });
            }

            if (resHistoryStatus && resHistoryStatus.status === 'success' && resHistoryStatus.data) {
                // Populate family history status
                const selectFamEstado = $('#fam_estado');
                selectFamEstado.empty();
                resHistoryStatus.data.forEach(item => {
                    selectFamEstado.append(new Option(item.display, item.code));
                });

                // Populate family history status in drawer
                if (this.antecedentesDrawer && this.antecedentesDrawer.drawerElement) {
                    const selectDrawerFamEstado = this.antecedentesDrawer.drawerElement.querySelector('#form-familiares select[name="estado"]');
                    if (selectDrawerFamEstado) {
                        selectDrawerFamEstado.innerHTML = resHistoryStatus.data.map(item => 
                            `<option value="${item.code}">${item.display}</option>`
                        ).join('');
                    }
                }
            }

            if (resAllergyStatus && resAllergyStatus.status === 'success' && resAllergyStatus.data) {
                const selectAleEstado = $('#ale_estado');
                selectAleEstado.empty();
                resAllergyStatus.data.forEach(item => {
                    selectAleEstado.append(new Option(item.display, item.code));
                });

                // Populate clinicalStatus select in drawer
                if (this.antecedentesDrawer && this.antecedentesDrawer.drawerElement) {
                    const selectDrawerAllergyEstado = this.antecedentesDrawer.drawerElement.querySelector('#form-alergias select[name="clinicalStatus"]');
                    if (selectDrawerAllergyEstado) {
                        selectDrawerAllergyEstado.innerHTML = resAllergyStatus.data.map(item => 
                            `<option value="${item.code}">${item.display}</option>`
                        ).join('');
                    }
                }
            }

            if (resMedStatus && resMedStatus.status === 'success' && resMedStatus.data) {
                const selectFarEstado = $('#far_estado');
                selectFarEstado.empty();
                resMedStatus.data.forEach(item => {
                    selectFarEstado.append(new Option(item.display, item.code));
                });
            }

            if (resVerif && resVerif.status === 'success' && resVerif.data) {
                // Populate pathological verification
                const selectVerif = $('#pat_verif');
                selectVerif.empty();
                resVerif.data.forEach(item => {
                    selectVerif.append(new Option(item.display, item.code));
                });

                // Populate allergic verification
                const selectAleVerif = $('#ale_verif');
                selectAleVerif.empty();
                resVerif.data.forEach(item => {
                    selectAleVerif.append(new Option(item.display, item.code));
                });

                // Populate verificationStatus select in drawer
                if (this.antecedentesDrawer && this.antecedentesDrawer.drawerElement) {
                    const selectDrawerAllergyVerif = this.antecedentesDrawer.drawerElement.querySelector('#form-alergias select[name="verificationStatus"]');
                    if (selectDrawerAllergyVerif) {
                        selectDrawerAllergyVerif.innerHTML = resVerif.data.map(item => 
                            `<option value="${item.code}">${item.display}</option>`
                        ).join('');
                    }
                }
            }

            // Populate Vía de Administración (CODIGO_VIA)
            if (resViaStatus && resViaStatus.status === 'success' && resViaStatus.data) {
                const selectVia = $('#CODIGO_VIA');
                selectVia.empty();
                selectVia.append(new Option('Seleccione vía...', '', true, true));
                selectVia.children().first().attr('disabled', true);
                resViaStatus.data.forEach(item => {
                    selectVia.append(new Option(item.display, item.code));
                });
            }

            // Populate Unidad de Medida de Frecuencia (UM_FRECUENCIA) y Duración (UM_DURACION)
            if (resFrecStatus && resFrecStatus.status === 'success' && resFrecStatus.data) {
                const selectFrec = $('#UM_FRECUENCIA');
                selectFrec.empty();
                selectFrec.append(new Option('Seleccione...', '', true, true));
                selectFrec.children().first().attr('disabled', true);
                resFrecStatus.data.forEach(item => {
                    selectFrec.append(new Option(item.display, item.code));
                });

                const selectDur = $('#UM_DURACION');
                selectDur.empty();
                selectDur.append(new Option('Seleccione...', '', true, true));
                selectDur.children().first().attr('disabled', true);
                resFrecStatus.data.forEach(item => {
                    selectDur.append(new Option(item.display, item.code));
                });
            }

            // Populate Unidad de Medida de Dosis (UM_DOSIS)
            if (resDosisStatus && resDosisStatus.status === 'success' && resDosisStatus.data) {
                const selectDosis = $('#UM_DOSIS');
                selectDosis.empty();
                selectDosis.append(new Option('Seleccione...', '', true, true));
                selectDosis.children().first().attr('disabled', true);
                resDosisStatus.data.forEach(item => {
                    selectDosis.append(new Option(item.display, item.code));
                });
            }

            // Populate Tipo de Tecnología de Salud (TIPO_TECNOLOGIA)
            if (resTechStatus && resTechStatus.status === 'success' && resTechStatus.data) {
                const selectTech = $('#TIPO_TECNOLOGIA');
                selectTech.empty();
                selectTech.append(new Option('Seleccione tecnología...', '', true, true));
                selectTech.children().first().attr('disabled', true);
                resTechStatus.data.forEach(item => {
                    selectTech.append(new Option(item.display, item.code));
                });
            }
        } catch (error) {
            console.error("Error al cargar estados y verificaciones:", error);
        }
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

    async loadOtros(pacienteId) {
        try {
            const res = await this.api.request(`getAntecedentesOtros.php?id_pcnte=${pacienteId}`, 'GET');
            if (res.status === 'success' && res.data && res.data.length > 0) {
                this.currentOtros = res.data[0];
            } else {
                this.currentOtros = null;
            }
        } catch (error) {
            console.error("Error loading otros antecedentes:", error);
            this.currentOtros = null;
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
                    const cieBadge = item.cie_10 ? `<span class="badge bg-sky-pale text-primary border font-monospace me-1 fs-8">${item.cie_10}</span>` : '';
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 70%;">
                                <span class="badge bg-secondary-subtle text-secondary border me-1 fs-8" style="font-size: 0.77rem !important;">${item.parentesco_nombre || 'Familiar'}</span>
                                ${cieBadge}
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
                    const codeBadge = item.codigo ? `<span class="badge bg-secondary-subtle text-secondary border font-monospace me-1 fs-8">${item.codigo}</span>` : '';
                    sideContainer.append(`
                        <div class="d-flex justify-content-between align-items-center border-bottom py-1.5 px-1 fs-7.5">
                            <div class="text-truncate" style="max-width: 70%;">
                                <div class="d-flex align-items-center gap-1 flex-wrap">
                                    ${codeBadge}
                                    <span class="fw-semibold text-primary fs-8 text-ellipsis" title="${item.descripcion}">${item.descripcion}</span>
                                </div>
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
        const timeline = this.currentTimeline || [];
        
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

        // --- Clinical History Integration ---
        if (timeline.length > 0) {
            const sortedTimeline = [...timeline].sort((a, b) => parseInt(b.cnsctvo_pcnte) - parseInt(a.cnsctvo_pcnte));
            const latest = sortedTimeline[0];
            const dateFormatted = this.formatMockupDate(latest.fcha_aprtra);

            summaryParts.push(`<br><span class="text-dark fw-bold"><i class="bi bi-clock-history me-1 text-primary"></i>Último Encuentro (${dateFormatted}):</span>`);
            
            const motivoText = latest.mtvo ? latest.mtvo.trim() : '';
            const diagText = latest.diagnostico_definitivo || latest.dgnstco_dfntvo || '';
            const evoText = latest.evlcion ? latest.evlcion.trim() : '';

            if (motivoText || diagText) {
                let encounterDetails = [];
                if (motivoText) encounterDetails.push(`motivo: <em>"${motivoText}"</em>`);
                if (diagText) encounterDetails.push(`diagnóstico: <strong class="text-primary">${diagText}</strong>`);
                summaryParts.push(`Registrado con ${encounterDetails.join(' y ')}.`);
            }

            if (evoText) {
                summaryParts.push(`Evolución: <em>"${evoText}"</em>.`);
            }

            // Vital Signs of the latest encounter
            let vitals = [];
            if (latest.prsion_artrial) vitals.push(`P.A.: <strong>${latest.prsion_artrial}</strong>`);
            if (latest.frcncia_crdca) vitals.push(`F.C.: <strong>${latest.frcncia_crdca} lpm</strong>`);
            if (latest.tmprtra) vitals.push(`Temp: <strong>${latest.tmprtra} °C</strong>`);
            if (latest.pso) vitals.push(`Peso: <strong>${latest.pso} kg</strong>`);
            if (latest.indce_msa_crpral) vitals.push(`IMC: <strong>${latest.indce_msa_crpral}</strong>`);

            if (vitals.length > 0) {
                summaryParts.push(`<br><span class="text-muted fw-semibold fs-9"><i class="bi bi-heart-pulse me-1"></i>Últimos Signos Vitales:</span> ${vitals.join(', ')}.`);
            }

            const planText = latest.plan_trptco || latest.plan;
            if (planText && planText.trim()) {
                summaryParts.push(`<br><span class="text-muted fw-semibold fs-9"><i class="bi bi-journal-medical me-1"></i>Plan Clínico:</span> <em>"${planText.trim()}"</em>.`);
            }
        } else {
            summaryParts.push(`<br><span class="text-muted"><i class="bi bi-info-circle me-1"></i>Sin consultas previas registradas en la historia clínica.</span>`);
        }

        $('#smart-clinical-summary-text').html(summaryParts.join(' '));

        // Smart dynamic tag parsing (Antecedents + Clinical History)
        let processedTags = new Set();
        let allDiagTexts = conditions.map(c => c.descripcion.toLowerCase());
        if (timeline.length > 0) {
            const sortedTimeline = [...timeline].sort((a, b) => parseInt(b.cnsctvo_pcnte) - parseInt(a.cnsctvo_pcnte));
            const latestDiag = (sortedTimeline[0].diagnostico_definitivo || sortedTimeline[0].dgnstco_dfntvo || '').toLowerCase();
            if (latestDiag && !allDiagTexts.includes(latestDiag)) {
                allDiagTexts.push(latestDiag);
            }
        }

        let tagsFound = false;
        allDiagTexts.forEach(desc => {
            if ((desc.includes('dolor') || desc.includes('pecho') || desc.includes('torácico') || desc.includes('pain') || desc.includes('chest')) && !processedTags.has('pain')) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-orange">Dolor Torácico</span>`);
                processedTags.add('pain');
                tagsFound = true;
            }
            if ((desc.includes('disnea') || desc.includes('respirar') || desc.includes('dyspnea')) && !processedTags.has('dyspnea')) {
                badgesContainer.append(`<span class="risk-tag-badge" style="background-color: #fef08a !important; color: #854d0e !important; border-radius: 50px; padding: 0.25rem 0.75rem; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center;">Disnea Leve</span>`);
                processedTags.add('dyspnea');
                tagsFound = true;
            }
            if ((desc.includes('hipertensión') || desc.includes('presión') || desc.includes('hypertension') || desc.includes('tensión')) && !processedTags.has('htn')) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-orange">Hipertensión Art.</span>`);
                processedTags.add('htn');
                tagsFound = true;
            }
            if ((desc.includes('cardio') || desc.includes('coronaria') || desc.includes('isquémica') || desc.includes('cad') || desc.includes('infarto')) && !processedTags.has('cad')) {
                badgesContainer.append(`<span class="risk-tag-badge risk-tag-yellow">Heredo-Fam CAD</span>`);
                processedTags.add('cad');
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

        // --- Signos de Alarma / Alertas Críticas (Banderas Rojas) ---
        let criticalAlerts = [];

        // 1. Alergias Críticas (AllergyIntolerance)
        if (allergies.length > 0) {
            const criticalAllergiesList = allergies
                .filter(a => a.criticidad === 'high' || a.criticality === 'high' || a.estado === 'active' || a.clinicalStatus === 'active')
                .map(a => a.descripcion || 'Alérgeno');
            
            if (criticalAllergiesList.length > 0) {
                criticalAlerts.push(`<i class="bi bi-x-circle-fill text-danger me-1"></i>Alergia crítica a: <strong>${criticalAllergiesList.join(', ')}</strong>`);
            }
        }

        // 2. Banderas Rojas Diagnósticas (Conditions / Timeline Diagnoses)
        let highRiskKeywords = [
            { words: ['sepsis', 'shock', 'choque', 'séptico', 'septicemia'], label: 'Criterio de sepsis / shock previo' },
            { words: ['sangrado', 'hemorragia', 'coagulopatía', 'hemofilia'], label: 'Riesgo de sangrado activo' },
            { words: ['isquémico', 'infarto', 'angina', 'isquemia', 'coronario'], label: 'Riesgo coronario / isquemia aguda' },
            { words: ['suicidio', 'suicida', 'autolesión'], label: 'Riesgo de autolesión / ideación suicida' },
            { words: ['epidem', 'brote', 'contagioso', 'tuberculosis', 'covid-19', 'dengue grave'], label: 'Alerta epidemiológica / aislamiento' }
        ];

        allDiagTexts.forEach(desc => {
            highRiskKeywords.forEach(item => {
                if (item.words.some(word => desc.includes(word))) {
                    if (!criticalAlerts.some(alert => alert.includes(item.label))) {
                        criticalAlerts.push(`<i class="bi bi-exclamation-circle-fill text-danger me-1"></i>${item.label}`);
                    }
                }
            });
        });

        // 3. Signos Vitales Críticos del último encuentro
        if (timeline.length > 0) {
            const sortedTimeline = [...timeline].sort((a, b) => parseInt(b.cnsctvo_pcnte) - parseInt(a.cnsctvo_pcnte));
            const latest = sortedTimeline[0];
            
            if (latest.tmprtra) {
                const tempVal = parseFloat(latest.tmprtra);
                if (tempVal >= 38.3) {
                    criticalAlerts.push(`<i class="bi bi-thermometer-high text-danger me-1"></i>Hipertermia / Fiebre: <strong>${tempVal} °C</strong>`);
                } else if (tempVal <= 35.0) {
                    criticalAlerts.push(`<i class="bi bi-thermometer-low text-danger me-1"></i>Hipotermia: <strong>${tempVal} °C</strong>`);
                }
            }
            
            if (latest.plso || latest.spo2) {
                const spo2Val = parseInt(latest.plso || latest.spo2, 10);
                if (spo2Val < 92) {
                    criticalAlerts.push(`<i class="bi bi-wind text-danger me-1"></i>Desaturación severa: <strong>SPO2 ${spo2Val}%</strong>`);
                }
            }
        }

        // Render alertas
        const panelAlertas = $('#panel-alertas-criticas');
        const listAlertas = $('#list-alertas-criticas');
        
        if (criticalAlerts.length > 0) {
            listAlertas.html(`<ul class="mb-0 ps-3 text-danger-emphasis">${criticalAlerts.map(a => `<li>${a}</li>`).join('')}</ul>`);
            panelAlertas.removeClass('d-none');
        } else {
            listAlertas.html('<span class="text-muted">Sin alertas activas.</span>');
            panelAlertas.addClass('d-none');
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
        this.currentTimeline = [];

        // Asegurar la existencia de los inputs de contexto global
        if ($('#global_id_pcnte').length === 0) {
            $('body').append('<input type="hidden" id="global_id_pcnte">');
        }
        if ($('#global_cnsctvo_pcnte').length === 0) {
            $('body').append('<input type="hidden" id="global_cnsctvo_pcnte">');
        }

        $('#global_id_pcnte').val(pacienteId);
        $('#global_cnsctvo_pcnte').val('1'); // Valor inicial predeterminado

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


        // Set loading states
        if ($('#panel-timeline-container').length > 0) {
            $('#panel-timeline-container').html('<div class="text-muted fs-8 text-center py-3"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Cargando histórico...</div>');
        }

        // Reset inputs and values
        if ($('#form-evolucion-diaria')[0]) $('#form-evolucion-diaria')[0].reset();
        $('.vital-input-card').removeClass('vital-alert-danger vital-alert-warning vital-alert-success');
        
        // Reset evolution tabs to the first tab and clear completed states
        const firstTabButton = $('#evo-form-tabs .clinical-step-tab-btn').first();
        if (firstTabButton.length > 0) {
            const bootstrapTab = new bootstrap.Tab(firstTabButton[0]);
            bootstrapTab.show();
        }
        $('#evo-form-tabs .clinical-step-tab-btn').removeClass('completed');

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

            this.currentTimeline = (resTimeline && !resTimeline.error && resTimeline.data) ? resTimeline.data : [];

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
                    
                    // Actualizar el consecutivo de la atención actual (último + 1)
                    const nextCns = parseInt(latest.cnsctvo_pcnte) + 1;
                    $('#global_cnsctvo_pcnte').val(nextCns);

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
                    $('#sidebar-vital-temp').text(latest.tmprtra ? `${parseFloat(latest.tmprtra).toFixed(1)}°C` : '--');
                    $('#sidebar-vital-rr').text(latest.frcncia_rsprtria || '--');
                    $('#sidebar-vital-peso').text(latest.pso ? `${latest.pso} kg` : '--');
                    $('#sidebar-vital-imc').text(latest.indce_msa_crpral || '--');

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
                    $('#sidebar-vital-rr').text('--');
                    $('#sidebar-vital-peso').text('--');
                    $('#sidebar-vital-imc').text('--');

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
            const user = this.storage.getUser();
            
            if (!this.selectedDiagnoses || this.selectedDiagnoses.length === 0) {
                throw new Error('Debe seleccionar al menos un diagnóstico antes de firmar y evolucionar.');
            }

            // Find principal or first diagnosis for history record
            const principalDiag = this.selectedDiagnoses.find(d => d.indicador === 'principal') || this.selectedDiagnoses[0];
            const diagDefVal = principalDiag ? `${principalDiag.code} - ${principalDiag.display}` : '';

            // Append Revisión por Sistemas to Observaciones if filled
            let obs = $('#evo_obsrvciones').length > 0 && $('#evo_obsrvciones').val() ? $('#evo_obsrvciones').val().trim() : '';
            const revSist = $('#evo_revision_sistemas').length > 0 && $('#evo_revision_sistemas').val() ? $('#evo_revision_sistemas').val().trim() : '';
            if (revSist) {
                obs = `Revisión por Sistemas: ${revSist}\nObservaciones: ${obs}`;
            }

            const payload = {
                id_pcnte: pacienteId,
                mtvo: $('#evo_motivo').length > 0 && $('#evo_motivo').val() ? $('#evo_motivo').val().trim() : null,
                evlcion: $('#evo_evlcion').length > 0 && $('#evo_evlcion').val() ? $('#evo_evlcion').val().trim() : null,
                enfrmdad: $('#evo_enfrmdad').length > 0 && $('#evo_enfrmdad').val() ? $('#evo_enfrmdad').val().trim() : null,
                estdo_gnral: $('#evo_estdo_gnral').length > 0 && $('#evo_estdo_gnral').val() ? $('#evo_estdo_gnral').val().trim() : null,
                lbrtrios: $('#evo_lbrtrios').length > 0 && $('#evo_lbrtrios').val() ? $('#evo_lbrtrios').val().trim() : null,
                anlsis: $('#evo_anlsis').length > 0 && $('#evo_anlsis').val() ? $('#evo_anlsis').val().trim() : null,
                observaciones: obs ? obs : null,
                diagnostico_definitivo: diagDefVal || null,
                plan: $('#evo_plan').length > 0 && $('#evo_plan').val() ? $('#evo_plan').val().trim() : null,
                pso: ($('#evo_pso').length > 0 && $('#evo_pso').val()) ? $('#evo_pso').val().toString() : null,
                tlla: ($('#evo_tlla').length > 0 && $('#evo_tlla').val()) ? parseFloat($('#evo_tlla').val()) : null,
                indce_msa_crpral: ($('#evo_imc').length > 0 && $('#evo_imc').val()) ? parseFloat($('#evo_imc').val()) : null,
                tmprtra: ($('#evo_tmprtra').length > 0 && $('#evo_tmprtra').val()) ? parseFloat($('#evo_tmprtra').val()) : null,
                prsion_artrial: ($('#evo_prsion').length > 0 && $('#evo_prsion').val()) ? $('#evo_prsion').val().trim() : null,
                frcncia_crdca: ($('#evo_frcncia_crdca').length > 0 && $('#evo_frcncia_crdca').val()) ? parseInt($('#evo_frcncia_crdca').val(), 10) : null,
                frcncia_rsprtria: ($('#evo_frcncia_rsprtria').length > 0 && $('#evo_frcncia_rsprtria').val()) ? parseInt($('#evo_frcncia_rsprtria').val(), 10) : null,
                plso: ($('#evo_plso').length > 0 && $('#evo_plso').val()) ? parseInt($('#evo_plso').val(), 10) : null,
                id_mdco: user ? user.id : null,
                usuario_ingreso: user ? user.id : 'API'
            };

            const response = await this.api.request('createHistoriaClinica.php', 'POST', payload);
            if (response.status === 'success') {
                const cnsctvo = response.cnsctvo_pcnte;

                // 1. Save all selected diagnoses to DIAGNOSTICOS_HC table
                for (const item of this.selectedDiagnoses) {
                    const diagPayload = {
                        id_pcnte: pacienteId,
                        cnsctvo_pcnte: cnsctvo,
                        codigo: item.code,
                        cie_10: item.code,
                        descripcion: item.display,
                        estado: 'active',
                        estado_verificacion: 'confirmed',
                        indicador_diagnostico: item.indicador,
                        tipo_diagnostico: item.tipo,
                        usuario_ingreso: user ? user.id : 'API'
                    };
                    await this.api.request('createDiagnosticoHC.php', 'POST', diagPayload)
                        .catch(err => console.error("Error creating DiagnosticoHC:", err));
                }

                // 2. Save new Formulation (MedicationRequest) to FORMULACION table
                const formulaDroga = $('#formula_droga').val() ? $('#formula_droga').val().trim() : '';
                if (formulaDroga) {
                    const formPayload = {
                        id_pcnte: pacienteId,
                        nmro_evlcion: cnsctvo,
                        cdgo_drga: $('#formula_codigo').val() ? $('#formula_codigo').val().trim() : 'GENERIC',
                        dscrpcion: formulaDroga,
                        dosis: $('#formula_dosis').val() ? $('#formula_dosis').val().trim() : null,
                        via: $('#formula_via').val() ? $('#formula_via').val() : 'Oral',
                        frecuencia: $('#formula_frecuencia').val() ? $('#formula_frecuencia').val().trim() : null,
                        duracion: $('#formula_duracion').val() ? $('#formula_duracion').val().trim() : null,
                        cntdad: $('#formula_cantidad').val() ? parseInt($('#formula_cantidad').val(), 10) : null,
                        pslgia: $('#formula_indicaciones').val() ? $('#formula_indicaciones').val().trim() : null,
                        plan: payload.plan,
                        id_mdco: user ? user.id : null,
                        usuario_ingreso: user ? user.id : 'API'
                    };
                    await this.api.request('createFormulacion.php', 'POST', formPayload).catch(err => console.error("Error creating Formulacion:", err));
                }

                // 3. Save new Procedure order (ServiceRequest) to PRCDMNTOS_RSLTDOS table
                const procDesc = $('#procedimiento_descripcion').val() ? $('#procedimiento_descripcion').val().trim() : '';
                if (procDesc) {
                    const procPayload = {
                        id_pcnte: pacienteId,
                        cnsctvo_pcnte: cnsctvo,
                        cdgo_prcdmnto: $('#procedimiento_codigo').val() ? $('#procedimiento_codigo').val().trim() : 'GENERIC',
                        dscrpcion_prcdmnto: procDesc,
                        cdgo_indcion: $('#procedimiento_indicacion').val() ? $('#procedimiento_indicacion').val().trim() : null,
                        id_mdco: user ? user.id : null,
                        usuario_ingreso: user ? user.id : 'API'
                    };
                    await this.api.request('createProcedimientoResultado.php', 'POST', procPayload).catch(err => console.error("Error creating ProcedimientoResultado:", err));
                }

                // 4. Save new Incapacidad (DocumentReference) to RMSION_INCPCDAD table
                const incapInicio = $('#incapacidad_inicio').val();
                const incapFin = $('#incapacidad_fin').val();
                if (incapInicio && incapFin) {
                    const incapPayload = {
                        id_pcnte: pacienteId,
                        cnsctvo_pcnte: cnsctvo,
                        fcha_incio: incapInicio,
                        fcha_fnal: incapFin,
                        drcion: $('#incapacidad_dias').val() ? parseInt($('#incapacidad_dias').val(), 10) : null,
                        dscrpcion_incpcdad: $('#incapacidad_motivo').val() ? $('#incapacidad_motivo').val().trim() : null,
                        id_mdco: user ? user.id : null,
                        usuario_ingreso: user ? user.id : 'API'
                    };
                    await this.api.request('createIncapacidad.php', 'POST', incapPayload).catch(err => console.error("Error creating Incapacidad:", err));
                }

                // 5. Generate and Show FHIR RDA Patient Bundle via FHIRAPI and tokenization details
                let tokenizarResponse = null;
                let rdaTokenResponse = null;
                try {
                    tokenizarResponse = await this.api.request('get_datos_tokenizar.php', 'POST', {
                        idntfccion_mdcos: user ? user.id : null
                    });

                    if (tokenizarResponse && tokenizarResponse.status === 'success' && tokenizarResponse.data) {
                        const rdaData = tokenizarResponse.data;
                        const tokenUrl = this.config && this.config.URL_GET_TOKEN_RDA ? this.config.URL_GET_TOKEN_RDA : 'https://login.microsoftonline.com/3d4b3d76-b910-426c-bd8f-bd964e3e1b53/oauth2/v2.0/token';

                        try {
                            rdaTokenResponse = await this.api.request('get_token_rda.php', 'POST', {
                                token_url: tokenUrl,
                                client_id: rdaData.client_id_rda,
                                client_secret: rdaData.client_secret,
                                scope: rdaData.scope
                            });
                        } catch (rdaTokenError) {
                            console.error("Error fetching RDA Token:", rdaTokenError);
                            rdaTokenResponse = {
                                error: true,
                                status: rdaTokenError.status,
                                responseText: rdaTokenError.message || 'Error en el servidor proxy'
                            };
                        }
                    }
                } catch (tokError) {
                    console.error("Error fetching tokenizar data:", tokError);
                }

                let sendFhirResponse = null;
                try {
                    const fhirResponse = await $.ajax({
                        url: '../FHIRAPI/index.php',
                        type: 'GET',
                        data: {
                            id_pcnte: pacienteId,
                            cnsctvo_pcnte: cnsctvo
                        },
                        dataType: 'json'
                    });
                    console.log("FHIR Bundle RDA successfully generated:", fhirResponse);

                    // Send FHIR RDA to Sandbox via proxy if token exists
                    const accessToken = rdaTokenResponse ? (rdaTokenResponse.access_token || rdaTokenResponse.accessToken) : null;
                    if (accessToken) {
                        const sendPrefix = this.config && this.config.URL_SEND_FHIR ? this.config.URL_SEND_FHIR : 'https://sandbox.ihcecol.gov.co/ihce/Composition/';
                        const sendUrl = sendPrefix + '$enviar-rda-paciente';

                        try {
                            sendFhirResponse = await this.api.request('send_fhir_rda.php', 'POST', {
                                send_url: sendUrl,
                                token: accessToken,
                                fhir_data: fhirResponse
                            });
                        } catch (sendError) {
                            console.error("Error sending FHIR RDA:", sendError);
                            sendFhirResponse = {
                                error: true,
                                status: sendError.status,
                                responseText: sendError.message || 'Error en el proxy de envío'
                            };
                        }
                    }

                    this.ui.showFhirResourceModal(fhirResponse, tokenizarResponse, rdaTokenResponse, sendFhirResponse);
                    this.ui.showToast('JSON FHIR del RDA generado correctamente.', 'success');
                } catch (fhirError) {
                    console.error("Error generating FHIR RDA Bundle:", fhirError);
                    this.ui.showToast('Evolución guardada, pero ocurrió un error al generar el JSON FHIR.', 'warning');
                }

                this.ui.showToast('Evolución clínica firmada exitosamente.', 'success');
                
                // Limpiar borrador de localStorage
                localStorage.removeItem(`draft_patient_${pacienteId}`);
                
                // Limpiar formulario y resetear pestañas a la primera
                $('#form-evolucion-diaria')[0].reset();
                const firstTabButton = $('#evo-form-tabs .clinical-step-tab-btn').first();
                if (firstTabButton.length > 0) {
                    const bootstrapTab = new bootstrap.Tab(firstTabButton[0]);
                    bootstrapTab.show();
                }
                $('#evo-form-tabs .clinical-step-tab-btn').removeClass('completed');

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
    { code: 'I10X', desc: 'HIPERTENSION ESENCIAL (PRIMARIA)' },
    { code: 'E119', desc: 'DIABETES MELLITUS NO INSULINODEPENDIENTE, SIN MENCION DE COMPLICACION' },
    { code: 'J459', desc: 'ASMA, NO ESPECIFICADA' },
    { code: 'K219', desc: 'ENFERMEDAD POR REFLUJO GASTROESOFAGICO SIN ESOFAGITIS' },
    { code: 'M545', desc: 'LUMBAGO NO ESPECIFICADO' },
    { code: 'J00X', desc: 'RINOFARINGITIS AGUDA [RESFRIADO COMUN]' },
    { code: 'U071', desc: 'COVID-19, VIRUS IDENTIFICADO' },
    { code: 'N390', desc: 'INFECCION DE VIAS URINARIAS, SITIO NO ESPECIFICADO' },
    { code: 'K297', desc: 'GASTRITIS, NO ESPECIFICADA' },
    { code: 'R51X', desc: 'CEFALEA' },
    { code: 'E669', desc: 'OBESIDAD, NO ESPECIFICADA' },
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

    async init() {
        // Cargar variables de entorno del frontend (.env alternativo)
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                const config = await response.json();
                this.formHandler.config = config; // Guardar config en formHandler
                if (config && config.API_BASE_URL) {
                    let url = config.API_BASE_URL.trim();
                    if (url.endsWith('/')) {
                        url = url.slice(0, -1);
                    }
                    this.api.baseUrl = url;
                }
            }
        } catch (e) {
            console.warn("Could not load config.json, using default relative path for API:", e);
        }

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

        // Botón para abrir el panel lateral de antecedentes FHIR
        $(document).on('click', '#btn-open-fhir-drawer', (e) => {
            e.preventDefault();
            const patientId = this.formHandler.currentPatientId;
            const patientName = this.formHandler.currentPatientName;
            if (patientId) {
                this.formHandler.antecedentesDrawer.open(patientId, patientName);
            } else {
                this.ui.showToast('Seleccione un paciente antes de abrir el historial.', 'warning');
            }
        });

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

        // State for Clinical Cart
        this.formHandler.medicationsCart = [];
        this.formHandler.proceduresCart = [];
        this.formHandler.incapacitiesCart = [];

        const updateCartUI = () => {
            // Update medications
            const medList = $('#cart-medications-list');
            medList.empty();
            if (this.formHandler.medicationsCart.length === 0) {
                medList.append('<li class="list-group-item text-muted text-center py-2.5 fs-9 italic" id="empty-meds-placeholder">No hay medicamentos agregados.</li>');
            } else {
                this.formHandler.medicationsCart.forEach((med, idx) => {
                    const labelDci = med.descripcion_dci || '';
                    const labelMed = med.descripcion_medicamento || '';
                    const mainTitle = labelDci && labelMed ? `${labelDci} (${labelMed})` : (labelDci || labelMed || 'Medicamento');
                    const techLabel = med.tipo_tecnologia_descripcion ? ` <span class="text-muted fs-9">(${med.tipo_tecnologia_descripcion})</span>` : '';
                    
                    const dosisStr = med.dosis ? `Tomar ${med.dosis} ${med.um_dosis_descripcion || med.um_dosis || ''}` : '';
                    const frecStr = med.frecuencia ? `cada ${med.frecuencia} ${med.um_frecuencia_descripcion || med.um_frecuencia || ''}` : '';
                    const durStr = med.duracion ? `por ${med.duracion} ${med.um_duracion_descripcion || med.um_duracion || ''}` : '';
                    const viaStr = med.via ? `Vía: ${med.via}` : '';
                    const posStr = med.posologia ? `(${med.posologia})` : '';

                    const details = [dosisStr, frecStr, durStr, viaStr, posStr].filter(Boolean).join(' ');

                    medList.append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2 fs-8.5">
                            <div>
                                <strong>${mainTitle}</strong>${techLabel}
                                <div class="text-secondary" style="font-size: 0.75rem;">${details}</div>
                            </div>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none btn-edit-cart-med" data-idx="${idx}">✏️</button>
                                <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none text-danger btn-delete-cart-med" data-idx="${idx}">X</button>
                            </div>
                        </li>
                    `);
                });
            }

            // Update procedures
            const procList = $('#cart-procedures-list');
            procList.empty();
            if (this.formHandler.proceduresCart.length === 0) {
                procList.append('<li class="list-group-item text-muted text-center py-2.5 fs-9 italic" id="empty-procs-placeholder">No hay procedimientos agregados.</li>');
            } else {
                this.formHandler.proceduresCart.forEach((proc, idx) => {
                    procList.append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2 fs-8.5">
                            <div>
                                <strong>${proc.descripcion}</strong> <span class="badge bg-secondary-subtle text-secondary fs-9.5">${proc.codigo}</span>
                                <div class="text-secondary" style="font-size: 0.75rem;">Prioridad: ${proc.prioridad} | Justificación: ${proc.indicacion}</div>
                            </div>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none btn-edit-cart-proc" data-idx="${idx}">✏️</button>
                                <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none text-danger btn-delete-cart-proc" data-idx="${idx}">X</button>
                            </div>
                        </li>
                    `);
                });
            }

            // Update incapacidades
            const incapList = $('#cart-incapacity-list');
            incapList.empty();
            if (this.formHandler.incapacitiesCart.length === 0) {
                incapList.append('<li class="list-group-item text-muted text-center py-2.5 fs-9 italic" id="empty-incap-placeholder">No hay incapacidades registradas.</li>');
            } else {
                this.formHandler.incapacitiesCart.forEach((incap, idx) => {
                    incapList.append(`
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2 fs-8.5">
                            <div>
                                <strong>${incap.dias} días</strong> <span class="text-muted">(${incap.contingencia})</span>
                                <div class="text-secondary" style="font-size: 0.75rem;">Inicio: ${incap.inicio} | Motivo: ${incap.motivo}</div>
                            </div>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none btn-edit-cart-incap" data-idx="${idx}">✏️</button>
                                <button type="button" class="btn btn-link btn-xs p-0 text-decoration-none text-danger btn-delete-cart-incap" data-idx="${idx}">X</button>
                            </div>
                        </li>
                    `);
                });
            }

            // Update counter
            const totalCount = this.formHandler.medicationsCart.length + this.formHandler.proceduresCart.length + this.formHandler.incapacitiesCart.length;
            $('#cart-counter').text(totalCount);
        };

        // Copiar Justificación desde Notas
        $(document).on('click', '#btn-copiar-justificacion', (e) => {
            e.preventDefault();
            const notas = $('#evo_plan').val().trim();
            if (notas) {
                $('#procedimiento_indicacion').val(notas);
                this.ui.showToast('Justificación copiada desde Conducta y Plan.', 'info');
            } else {
                this.ui.showToast('No hay texto en Conducta y Plan para copiar.', 'warning');
            }
        });

        // Autocomplete asíncrono para buscar_medicamento con la tabla IUM
        let debounceTimer;
        $(document).on('input', '#buscar_medicamento', (e) => {
            clearTimeout(debounceTimer);
            const query = $(e.currentTarget).val().trim();
            const resultsDropdown = $('#resultados_ium');

            if (query.length < 3) {
                resultsDropdown.removeClass('show').empty();
                return;
            }

            debounceTimer = setTimeout(() => {
                this.api.request(`getIUM.php?search=${encodeURIComponent(query)}`, 'GET')
                    .then(res => {
                        resultsDropdown.empty();
                        if (res && res.status === 'success' && res.data && res.data.length > 0) {
                            res.data.forEach(item => {
                                const optionText = item.display;
                                const itemLi = $(`<li><a class="dropdown-item fs-8 py-1" href="#" style="white-space: normal;">${optionText}</a></li>`);
                                
                                itemLi.find('a').on('click', (evt) => {
                                    evt.preventDefault();
                                    $('#buscar_medicamento').val(optionText);
                                    
                                    // Separar DCI y Comercial del display format: DCI (COMERCIAL) - FORMA
                                    let dci = '';
                                    let comercial = '';
                                    const match = optionText.match(/^([^(]+)(?:\(([^)]+)\))?/);
                                    if (match) {
                                        dci = match[1].trim();
                                        comercial = match[2] ? match[2].trim() : dci;
                                    } else {
                                        dci = optionText;
                                        comercial = optionText;
                                    }
                                    
                                    $('#CODIGO_MEDICAMENTO').val(item.code || 'GENERIC');
                                    $('#DESCRIPCION_MEDICAMENTO').val(comercial);
                                    $('#CODIGO_DCI').val(item.code || 'GENERIC');
                                    $('#DESCRIPCION_DCI').val(dci);
                                    
                                    resultsDropdown.removeClass('show').empty();
                                    $('#DOSIS').focus();
                                });
                                resultsDropdown.append(itemLi);
                            });
                            resultsDropdown.addClass('show');
                        } else {
                            resultsDropdown.removeClass('show');
                        }
                    })
                    .catch(err => {
                        console.error('Error al consultar IUM:', err);
                        resultsDropdown.removeClass('show').empty();
                    });
            }, 300);
        });

        // Cerrar dropdown al hacer click fuera
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.position-relative').length) {
                $('#resultados_ium').removeClass('show');
            }
        });

        // Eventos agregar al carrito
        $(document).on('click', '#btn-agregar-medicamento', () => {
            // Limpiar estados de invalidación anteriores
            $('#buscar_medicamento').removeClass('is-invalid');
            $('#TIPO_TECNOLOGIA').removeClass('is-invalid');

            // Capturar contexto clínico global
            const idPaciente = document.getElementById('global_id_pcnte')?.value || this.currentPatientId;
            const consecutivoPaciente = document.getElementById('global_cnsctvo_pcnte')?.value || '1';

            if (!idPaciente || !consecutivoPaciente) {
                console.error("Error: No se detectó el contexto del paciente o de la atención actual");
                this.ui.showToast('No se puede agregar el medicamento: Falta el contexto de paciente/atención.', 'danger');
                return;
            }

            const hasIumCodes = $('#CODIGO_MEDICAMENTO').val() && $('#DESCRIPCION_MEDICAMENTO').val();
            const hasTech = $('#TIPO_TECNOLOGIA').val();

            let isValid = true;
            if (!hasIumCodes) {
                $('#buscar_medicamento').addClass('is-invalid');
                this.ui.showToast('Debe buscar y seleccionar un medicamento válido desde el buscador (IUM).', 'warning');
                isValid = false;
            }
            if (!hasTech) {
                $('#TIPO_TECNOLOGIA').addClass('is-invalid');
                this.ui.showToast('Debe seleccionar el Tipo de Tecnología de Salud.', 'warning');
                isValid = false;
            }

            if (!isValid) return;

            const descMed = $('#DESCRIPCION_MEDICAMENTO').val().trim();
            const descDci = $('#DESCRIPCION_DCI').val().trim();
            const carritoFormulas = this.formHandler.medicationsCart;

            const medObj = {
                codigo_medicamento: $('#CODIGO_MEDICAMENTO').val() || 'GENERIC',
                descripcion_medicamento: descMed,
                codigo_dci: $('#CODIGO_DCI').val() || 'GENERIC',
                descripcion_dci: descDci,
                dosis: parseFloat($('#DOSIS').val()) || 0,
                um_dosis: $('#UM_DOSIS').val(),
                um_dosis_descripcion: $('#UM_DOSIS option:selected').text(),
                frecuencia: parseInt($('#formula_frecuencia').val(), 10) || 0,
                um_frecuencia: $('#UM_FRECUENCIA').val(),
                um_frecuencia_descripcion: $('#UM_FRECUENCIA option:selected').text(),
                codigo_via: $('#CODIGO_VIA').val(),
                via: $('#CODIGO_VIA option:selected').text(),
                duracion: parseInt($('#formula_duracion').val(), 10) || 0,
                um_duracion: $('#UM_DURACION').val(),
                um_duracion_descripcion: $('#UM_DURACION option:selected').text(),
                posologia: $('#formula_posologia').val().trim(),
                tipo_tecnologia: $('#TIPO_TECNOLOGIA').val(),
                tipo_tecnologia_descripcion: $('#TIPO_TECNOLOGIA option:selected').text(),
                // Contexto clínico global (llaves exigidas en mayúsculas y minúsculas para compatibilidad)
                ID_PCNTE: idPaciente,
                CNSCTVO_PCNTE: parseInt(consecutivoPaciente, 10),
                id_pcnte: idPaciente,
                cnsctvo_pcnte: parseInt(consecutivoPaciente, 10),
                formula: $('#formula_formula').val() || '',
                cnsctvo_formula: carritoFormulas.length + 1,
                id_mdco: $('#formula_id_mdco').val() || ''
            };

            carritoFormulas.push(medObj);
            updateCartUI();

            // Clear inputs
            $('#buscar_medicamento').val('');
            $('#CODIGO_MEDICAMENTO').val('');
            $('#DESCRIPCION_MEDICAMENTO').val('');
            $('#CODIGO_DCI').val('');
            $('#DESCRIPCION_DCI').val('');
            $('#DOSIS').val('');
            $('#formula_frecuencia').val('');
            $('#formula_duracion').val('');
            $('#formula_posologia').val('');
            $('#TIPO_TECNOLOGIA').val('');
            
            // Return focus to buscador IUM
            $('#buscar_medicamento').focus();
            this.ui.showToast('Medicamento agregado al carrito.', 'success');
        });

        $(document).on('click', '#btn-agregar-procedimiento', () => {
            const desc = $('#procedimiento_descripcion').val().trim();
            if (!desc) {
                this.ui.showToast('Ingrese la descripción del procedimiento.', 'warning');
                return;
            }
            const procObj = {
                descripcion: desc,
                codigo: $('#procedimiento_codigo').val().trim() || 'GENERIC',
                indicacion: $('#procedimiento_indicacion').val().trim(),
                prioridad: $('#procedimiento_prioridad').val()
            };

            this.formHandler.proceduresCart.push(procObj);
            updateCartUI();

            // Clear inputs
            $('#procedimiento_descripcion').val('');
            $('#procedimiento_codigo').val('');
            $('#procedimiento_indicacion').val('');
            this.ui.showToast('Procedimiento agregado al carrito.', 'success');
        });

        $(document).on('click', '#btn-agregar-incapacidad', () => {
            const inicio = $('#incapacidad_inicio').val();
            const fin = $('#incapacidad_fin').val();
            if (!inicio || !fin) {
                this.ui.showToast('Seleccione fecha de inicio y fin.', 'warning');
                return;
            }
            const dias = $('#incapacidad_dias').val() || 1;
            const incapObj = {
                inicio: inicio,
                fin: fin,
                dias: dias,
                contingencia: $('#incapacidad_contingencia').val(),
                motivo: $('#incapacidad_motivo').val().trim()
            };

            this.formHandler.incapacitiesCart.push(incapObj);
            updateCartUI();

            // Clear inputs
            $('#incapacidad_inicio').val('');
            $('#incapacidad_fin').val('');
            $('#incapacidad_dias').val('');
            $('#incapacidad_motivo').val('');
            this.ui.showToast('Incapacidad agregada al carrito.', 'success');
        });

        // Eliminar del carrito
        $(document).on('click', '.btn-delete-cart-med', function(e) {
            const idx = $(e.currentTarget).data('idx');
            this.formHandler.medicationsCart.splice(idx, 1);
            updateCartUI();
        }.bind(this));

        $(document).on('click', '.btn-delete-cart-proc', function(e) {
            const idx = $(e.currentTarget).data('idx');
            this.formHandler.proceduresCart.splice(idx, 1);
            updateCartUI();
        }.bind(this));

        $(document).on('click', '.btn-delete-cart-incap', function(e) {
            const idx = $(e.currentTarget).data('idx');
            this.formHandler.incapacitiesCart.splice(idx, 1);
            updateCartUI();
        }.bind(this));

        // Editar del carrito (rellena los inputs para edición)
        $(document).on('click', '.btn-edit-cart-med', function(e) {
            const idx = $(e.currentTarget).data('idx');
            const med = this.formHandler.medicationsCart[idx];
            
            const displayTitle = med.descripcion_dci && med.descripcion_medicamento 
                ? `${med.descripcion_dci} (${med.descripcion_medicamento})` 
                : (med.descripcion_dci || med.descripcion_medicamento || '');
                
            $('#buscar_medicamento').val(displayTitle);
            $('#CODIGO_MEDICAMENTO').val(med.codigo_medicamento);
            $('#DESCRIPCION_MEDICAMENTO').val(med.descripcion_medicamento);
            $('#CODIGO_DCI').val(med.codigo_dci);
            $('#DESCRIPCION_DCI').val(med.descripcion_dci);
            $('#DOSIS').val(med.dosis);
            $('#UM_DOSIS').val(med.um_dosis);
            $('#formula_frecuencia').val(med.frecuencia);
            $('#UM_FRECUENCIA').val(med.um_frecuencia);
            $('#CODIGO_VIA').val(med.codigo_via);
            $('#formula_duracion').val(med.duracion);
            $('#UM_DURACION').val(med.um_duracion);
            $('#formula_posologia').val(med.posologia);
            $('#TIPO_TECNOLOGIA').val(med.tipo_tecnologia || '');
            // Hidden metadata fields
            $('#formula_id_pcnte').val(med.id_pcnte);
            $('#formula_cnsctvo_pcnte').val(med.cnsctvo_pcnte);
            $('#formula_formula').val(med.formula);
            $('#formula_cnsctvo_formula').val(med.cnsctvo_formula);
            $('#formula_id_mdco').val(med.id_mdco);
            
            this.formHandler.medicationsCart.splice(idx, 1);
            updateCartUI();
            this.ui.showToast('Cargado en formulario para edición.', 'info');
        }.bind(this));

        $(document).on('click', '.btn-edit-cart-proc', function(e) {
            const idx = $(e.currentTarget).data('idx');
            const proc = this.formHandler.proceduresCart[idx];
            $('#procedimiento_descripcion').val(proc.descripcion);
            $('#procedimiento_codigo').val(proc.codigo);
            $('#procedimiento_indicacion').val(proc.indicacion);
            $('#procedimiento_prioridad').val(proc.prioridad);
            this.formHandler.proceduresCart.splice(idx, 1);
            updateCartUI();
            this.ui.showToast('Cargado en formulario para edición.', 'info');
        }.bind(this));

        $(document).on('click', '.btn-edit-cart-incap', function(e) {
            const idx = $(e.currentTarget).data('idx');
            const incap = this.formHandler.incapacitiesCart[idx];
            $('#incapacidad_inicio').val(incap.inicio);
            $('#incapacidad_fin').val(incap.fin);
            $('#incapacidad_dias').val(incap.dias);
            $('#incapacidad_contingencia').val(incap.contingencia);
            $('#incapacidad_motivo').val(incap.motivo);
            this.formHandler.incapacitiesCart.splice(idx, 1);
            updateCartUI();
            this.ui.showToast('Cargado en formulario para edición.', 'info');
        }.bind(this));

        // Calcular días de incapacidad automáticamente
        $(document).on('change', '#incapacidad_inicio, #incapacidad_fin', () => {
            const inicioVal = $('#incapacidad_inicio').val();
            const finVal = $('#incapacidad_fin').val();
            if (inicioVal && finVal) {
                const date1 = new Date(inicioVal);
                const date2 = new Date(finVal);
                const diffTime = Math.abs(date2 - date1);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                $('#incapacidad_dias').val(diffDays);
            }
        });

        // Emitir Órdenes y Firmar Plan (Acción transaccional del módulo)
        $(document).on('click', '#btn-emitir-ordenes', async (e) => {
            e.preventDefault();
            
            const carritoFormulas = this.formHandler.medicationsCart;
            if (carritoFormulas.length === 0) {
                this.ui.showToast('El plan no contiene fórmulas médicas para emitir.', 'warning');
                return;
            }

            // Mapear los datos de pacientes de forma dinámica si no vienen en la metadata oculta del carrito
            const id_pcnte = document.getElementById('global_id_pcnte')?.value || this.currentPatientId || ''; 
            const cnsctvo_pcnte = document.getElementById('global_cnsctvo_pcnte')?.value || '1';

            carritoFormulas.forEach(med => {
                if (!med.ID_PCNTE) med.ID_PCNTE = id_pcnte;
                if (!med.CNSCTVO_PCNTE) med.CNSCTVO_PCNTE = parseInt(cnsctvo_pcnte, 10);
                if (!med.id_pcnte) med.id_pcnte = id_pcnte;
                if (!med.cnsctvo_pcnte) med.cnsctvo_pcnte = parseInt(cnsctvo_pcnte, 10);
            });

            try {
                const token = this.api.storage.getToken();
                const url = `${this.api.baseUrl}/createFormulacionHC.php`;
                
                const payloadToSend = { formulas: carritoFormulas };
                console.log('PROCESANDO TRANSACCIÓN - PAYLOAD JSON ENVIADO A FORMULACION_HC:', JSON.stringify(payloadToSend, null, 2));
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payloadToSend)
                });

                const result = await response.json();
                console.log('RESPUESTA DETALLADA DEL BACKEND:', JSON.stringify(result, null, 2));

                if (response.ok && (result.status === 'success' || result.status === 'created')) {
                    this.ui.showToast('Plan de Fórmulas Médicas emitido y firmado exitosamente.', 'success');
                    
                    // Vaciar estado local y UI
                    this.formHandler.medicationsCart = [];
                    updateCartUI();
                    
                    // Proceder a enviar el formulario general para consolidar la evolución diaria
                    $('#form-evolucion-diaria').submit();
                } else {
                    console.error('Error del servidor al registrar formulaciones (Detalle del rechazo):', result);
                    this.ui.showToast(result.message || 'Error al emitir el plan de fórmulas.', 'danger');
                }
            } catch (err) {
                console.error('Error de red/petición al emitir y firmar plan:', err);
                this.ui.showToast('Error de red al conectar con el servidor.', 'danger');
            }
        });

        // Diagnóstico CIE-10 autocomplete search with Debounce and min-length check
        let searchCie10Timeout = null;

        const handleExactMatchCie10 = async () => {
            const query = $('#search-cie10-input').val().trim().toUpperCase();
            if (!query) return false;

            const cie10Pattern = /^[A-Z][0-9]{2,3}[A-Z0-9]?$/i;
            if (cie10Pattern.test(query)) {
                try {
                    const res = await this.api.request(`getCIE10.php?search=${encodeURIComponent(query)}`, 'GET');
                    let results = [];
                    if (res && res.status === 'success' && res.data && res.data.length > 0) {
                        results = res.data;
                    }
                    
                    const match = results.find(item => item.code.toUpperCase() === query) ||
                                  (results.length > 0 && results[0].code.toUpperCase() === query ? results[0] : null);
                    
                    if (match) {
                        this.formHandler.addDiagnosis(match.code, match.display);
                        $('#search-cie10-input').val('');
                        $('#search-cie10-dropdown').addClass('d-none');
                        
                        // Focus next field (Priority Select)
                        $('#evo_indicador_diagnostico').focus();
                        return true;
                    }
                } catch (err) {
                    console.error("Error in exact match query:", err);
                }
            }
            return false;
        };

        $('#search-cie10-input').on('keydown', async (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                const handled = await handleExactMatchCie10();
                if (handled) {
                    e.preventDefault();
                }
            }
        });

        $('#search-cie10-input').on('blur', () => {
            setTimeout(async () => {
                await handleExactMatchCie10();
            }, 200);
        });

        $('#search-cie10-input').on('input', (e) => {
            const query = $(e.target).val().trim();
            const dropdown = $('#search-cie10-dropdown');
            const listContainer = $('#search-cie10-list');

            if (searchCie10Timeout) {
                clearTimeout(searchCie10Timeout);
            }

            if (query.length < 3) {
                listContainer.empty();
                dropdown.addClass('d-none');
                return;
            }

            searchCie10Timeout = setTimeout(async () => {
                listContainer.empty();
                listContainer.append('<div class="list-group-item text-muted text-center fs-8 py-2"><span class="spinner-border spinner-border-sm text-primary me-1"></span>Buscando...</div>');
                dropdown.removeClass('d-none');

                try {
                    // Query database via API
                    const res = await this.api.request(`getCIE10.php?search=${encodeURIComponent(query)}`, 'GET');
                    
                    let results = [];
                    if (res && res.status === 'success' && res.data && res.data.length > 0) {
                        results = res.data;
                    } else {
                        // Fallback to local dictionary
                        const queryLower = query.toLowerCase();
                        results = CIE10_DICTIONARY.filter(item => 
                            item.code.toLowerCase().includes(queryLower) || 
                            item.desc.toLowerCase().includes(queryLower)
                        ).map(item => ({
                            code: item.code,
                            display: item.desc
                        })).slice(0, 15);
                    }

                    listContainer.empty();
                    if (results.length > 0) {
                        results.forEach(item => {
                            listContainer.append(`
                                <button type="button" class="list-group-item list-group-item-action cie10-item text-start d-flex flex-column align-items-start p-2 border-0 border-bottom" data-code="${item.code}" data-desc="${item.display}">
                                    <span class="badge bg-primary-subtle text-primary mb-1 fw-bold font-monospace fs-8.5">${item.code}</span>
                                    <span class="small text-dark lh-sm text-wrap w-100 text-start d-block" title="${item.display}">${item.display}</span>
                                </button>
                            `);
                        });
                    } else {
                        listContainer.append('<div class="list-group-item text-muted text-center fs-8 py-2">Sin resultados</div>');
                    }
                } catch (error) {
                    console.error("Error fetching CIE10 from API, falling back to local dictionary:", error);
                    
                    // Fallback to local dictionary
                    const queryLower = query.toLowerCase();
                    const localResults = CIE10_DICTIONARY.filter(item => 
                        item.code.toLowerCase().includes(queryLower) || 
                        item.desc.toLowerCase().includes(queryLower)
                    ).map(item => ({
                        code: item.code,
                        display: item.desc
                    })).slice(0, 15);

                    listContainer.empty();
                    if (localResults.length > 0) {
                        localResults.forEach(item => {
                            listContainer.append(`
                                <button type="button" class="list-group-item list-group-item-action cie10-item text-start d-flex flex-column align-items-start p-2 border-0 border-bottom" data-code="${item.code}" data-desc="${item.display}">
                                    <span class="badge bg-primary-subtle text-primary mb-1 fw-bold font-monospace fs-8.5">${item.code}</span>
                                    <span class="small text-dark lh-sm text-wrap w-100 text-start d-block" title="${item.display}">${item.display}</span>
                                </button>
                            `);
                        });
                    } else {
                        listContainer.append('<div class="list-group-item text-muted text-center fs-8 py-2">Sin resultados</div>');
                    }
                }
            }, 300);
        });

        // Selección de diagnóstico
        $(document).on('click', '.cie10-item', (e) => {
            e.preventDefault();
            const btn = $(e.target).closest('.cie10-item');
            const code = btn.data('code');
            const desc = btn.data('desc');

            this.formHandler.addDiagnosis(code, desc);
            
            $('#search-cie10-input').val('');
            $('#search-cie10-dropdown').addClass('d-none');
        });

        // Favoritos / Frecuentes click handler
        $(document).on('click', '.badge-frecuente-cie10', (e) => {
            e.preventDefault();
            const code = $(e.currentTarget).data('code');
            const desc = $(e.currentTarget).data('desc');
            
            this.formHandler.addDiagnosis(code, desc);
        });

        // Eliminar diagnóstico de la tabla
        $(document).on('click', '.btn-delete-diag', (e) => {
            e.preventDefault();
            const btn = $(e.target).closest('.btn-delete-diag');
            const index = parseInt(btn.data('index'), 10);
            
            this.formHandler.removeDiagnosis(index);
        });

        // Ocultar dropdown al hacer clic fuera
        $(document).on('click', (e) => {
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

        // -------------------------------------------------------------
        // CLINICAL TABS - SEQUENCE & NAVIGATION FLOW HANDLERS
        // -------------------------------------------------------------

        // Programmatic Navigation: Continuar (Next) button
        $(document).on('click', '.btn-next-step', (e) => {
            e.preventDefault();
            // Validate required fields in the current active tab pane
            const currentPane = $('.tab-content .tab-pane.active');
            let isValid = true;

            currentPane.find('input[required], textarea[required], select[required]').each(function() {
                if (!this.checkValidity()) {
                    this.reportValidity();
                    isValid = false;
                    return false; // break the loop
                }
            });

            if (!isValid) return;

            // Find the active tab button and show the next tab
            const activeTabBtn = $('#evo-form-tabs .clinical-step-tab-btn.active');
            const nextTabBtn = activeTabBtn.closest('li').next('li').find('.clinical-step-tab-btn');
            if (nextTabBtn.length > 0) {
                const bootstrapTab = new bootstrap.Tab(nextTabBtn[0]);
                bootstrapTab.show();
            }
        });

        // Programmatic Navigation: Anterior (Prev) button
        $(document).on('click', '.btn-prev-step', (e) => {
            e.preventDefault();
            const activeTabBtn = $('#evo-form-tabs .clinical-step-tab-btn.active');
            const prevTabBtn = activeTabBtn.closest('li').prev('li').find('.clinical-step-tab-btn');
            if (prevTabBtn.length > 0) {
                const bootstrapTab = new bootstrap.Tab(prevTabBtn[0]);
                bootstrapTab.show();
            }
        });

        // Prevent skipping ahead if current tab is invalid (manual tab clicks)
        $(document).on('show.bs.tab', '#evo-form-tabs button.clinical-step-tab-btn', function (e) {
            const allTabs = $('#evo-form-tabs .clinical-step-tab-btn');
            const prevTab = $(e.relatedTarget);
            const targetTab = $(e.target);

            const prevIndex = allTabs.index(prevTab);
            const targetIndex = allTabs.index(targetTab);

            // If user attempts to jump ahead
            if (prevIndex !== -1 && targetIndex > prevIndex) {
                const currentPane = $('.tab-content .tab-pane.active');
                let isValid = true;
                currentPane.find('input[required], textarea[required], select[required]').each(function() {
                    if (!this.checkValidity()) {
                        this.reportValidity();
                        isValid = false;
                        return false;
                    }
                });

                if (!isValid) {
                    e.preventDefault(); // cancel tab change
                }
            }
        });

        // Visual completion indicators: toggle completed status on prior steps
        $(document).on('shown.bs.tab', '#evo-form-tabs button.clinical-step-tab-btn', function (e) {
            const allTabs = $('#evo-form-tabs .clinical-step-tab-btn');
            const activeIndex = allTabs.index(e.target);

            allTabs.each(function(index) {
                if (index < activeIndex) {
                    $(this).addClass('completed');
                } else {
                    $(this).removeClass('completed');
                }
            });
        });

        // Dynamic Calculation of Incapacidad Days (Start to End date diff + 1)
        $(document).on('change input', '#incapacidad_inicio, #incapacidad_fin', () => {
            const inicioStr = $('#incapacidad_inicio').val();
            const finStr = $('#incapacidad_fin').val();

            if (inicioStr && finStr) {
                const inicio = new Date(inicioStr + 'T00:00:00');
                const fin = new Date(finStr + 'T00:00:00');

                if (fin >= inicio) {
                    const diffTime = fin - inicio;
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    $('#incapacidad_dias').val(diffDays);
                } else {
                    $('#incapacidad_dias').val(0);
                }
            } else {
                // If either is empty, clear the days field
                $('#incapacidad_dias').val('');
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
