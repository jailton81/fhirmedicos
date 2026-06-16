/**
 * Componente Modular: AntecedentesDrawer
 * Desarrollado bajo estándares FHIR e interfaz nativa de Bootstrap 5.
 * 
 * Permite visualizar y capturar antecedentes médicos del paciente utilizando componentes Offcanvas,
 * Accordion y formularios compactos de Bootstrap de alta densidad.
 */

class AntecedentesDrawer {
    /**
     * @param {Object} options
     * @param {HTMLElement} [options.mountElement=document.body] - Elemento donde se inyectará el drawer.
     * @param {Function} [options.onSave] - Callback llamado al guardar un antecedente. Firma: (type, fhirResource) => {}
     * @param {Function} [options.onClose] - Callback llamado al cerrar el drawer.
     */
    constructor(options = {}) {
        this.mountElement = options.mountElement || document.body;
        this.onSave = options.onSave || null;
        this.onClose = options.onClose || null;

        // Estado inicial de datos y UI
        this.state = {
            pacienteId: null,
            patientName: '',
            data: {
                conditions: [],       // Mapea a FHIR: Condition (Patológicos)
                medications: [],      // Mapea a FHIR: MedicationStatement (Farmacológicos)
                familyHistory: [],    // Mapea a FHIR: FamilyMemberHistory (Familiares)
                allergies: []         // Mapea a FHIR: AllergyIntolerance (Alergias)
            },
            ui: {
                isOpen: false
            }
        };

        this.drawerElement = null;
        this.offcanvasInstance = null;
        this.init();
    }

    /**
     * Inicializa el DOM e inyecta la estructura básica del Drawer usando clases de Bootstrap 5.
     */
    init() {
        // Crear elemento contenedor
        const wrapper = document.createElement('div');
        wrapper.id = 'antecedentes-drawer-container';
        wrapper.innerHTML = `
            <!-- Bootstrap 5 Offcanvas Panel -->
            <div class="offcanvas offcanvas-end bg-light border-start shadow-lg" tabindex="-1" id="offcanvasAntecedentesFHIR" style="width: 35vw; min-width: 380px;">
                <!-- Header -->
                <div class="offcanvas-header border-bottom bg-white py-2 px-3 d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-2">
                        <div class="text-primary bg-primary bg-opacity-10 p-1.5 rounded flex items-center justify-center">
                            <i class="bi bi-journal-medical fs-5 leading-none"></i>
                        </div>
                        <div>
                            <h5 class="offcanvas-title fw-bold text-dark fs-7.5 mb-0" style="letter-spacing: -0.2px;">Historial de Antecedentes FHIR</h5>
                            <p class="text-muted mb-0 font-monospace" style="font-size: 0.65rem;">
                                Paciente: <strong class="text-dark" id="drawer-patient-name">Cargando...</strong> 
                                <span class="mx-1">•</span> 
                                ID: <strong class="text-dark" id="drawer-patient-id">--</strong>
                            </p>
                        </div>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close" id="drawer-close-btn" style="font-size: 0.75rem;"></button>
                </div>

                <!-- Offcanvas Body -->
                <div class="offcanvas-body p-3" style="overflow-y: auto;">
                    
                    <div class="accordion accordion-flush" id="accordionAntecedentesFHIR">
                        
                        <!-- ACCORDION: PATOLÓGICOS (Condition) -->
                        <div class="accordion-item border rounded mb-2 overflow-hidden shadow-sm bg-white" data-accordion="patologicos">
                            <h2 class="accordion-header" id="headingPatologicoFHIR">
                                <button class="accordion-button py-2.5 px-3 bg-light text-dark fw-bold fs-8 d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePatologicoFHIR" aria-expanded="true" aria-controls="collapsePatologicoFHIR">
                                    <i class="bi bi-heart-pulse text-danger me-2 fs-6"></i>
                                    <span class="me-1.5">Personales / Patológicos</span>
                                    <span class="badge bg-secondary rounded-pill font-monospace count-badge me-1.5" style="font-size: 0.65rem;">0</span>
                                    <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 uppercase font-semibold scale-90" style="font-size: 0.55rem; padding: 0.15rem 0.25rem;">Condition</span>
                                </button>
                            </h2>
                            <div id="collapsePatologicoFHIR" class="accordion-collapse collapse show" aria-labelledby="headingPatologicoFHIR" data-bs-parent="#accordionAntecedentesFHIR">
                                <div class="accordion-body p-2.5 bg-white">
                                    <!-- Add Button -->
                                    <div class="d-flex justify-content-end mb-2">
                                        <button type="button" class="btn btn-outline-primary btn-sm py-0.5 px-2 btn-add-form" data-type="patologicos" style="font-size: 0.7rem; font-weight: 600;">
                                            <i class="bi bi-plus-circle me-1"></i>Añadir
                                        </button>
                                    </div>
                                    
                                    <!-- Items List -->
                                    <div class="items-list list-group list-group-flush mb-2 border rounded" id="list-patologicos"></div>
                                    
                                    <!-- Micro Form -->
                                    <form class="hidden-form d-none bg-light border border-secondary border-opacity-15 rounded p-2.5 mb-1" id="form-patologicos">
                                        <div class="row g-2 mb-2">
                                            <div class="col-7">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Diagnóstico (Descripción)</label>
                                                <input type="text" name="descripcion" class="form-control form-control-sm" placeholder="Ej: Hipertensión Arterial" style="font-size: 0.75rem;" required>
                                            </div>
                                            <div class="col-5">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Código CIE-10</label>
                                                <input type="text" name="codigo" class="form-control form-control-sm font-monospace text-uppercase" placeholder="Ej: I10" style="font-size: 0.75rem;">
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Estado Clínico</label>
                                                <select name="clinicalStatus" class="form-select form-select-sm" style="font-size: 0.75rem;">
                                                    <option value="active" selected>Activo</option>
                                                    <option value="inactive">Inactivo</option>
                                                    <option value="resolved">Resuelto</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Verificación</label>
                                                <select name="verificationStatus" class="form-select form-select-sm" style="font-size: 0.75rem;">
                                                    <option value="confirmed" selected>Confirmado</option>
                                                    <option value="unconfirmed">Sin Confirmar</option>
                                                </select>
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Edad al diagnóstico</label>
                                                <input type="number" name="edad" class="form-control form-control-sm" placeholder="Años" style="font-size: 0.75rem;">
                                            </div>
                                            <div class="col-8">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Observaciones</label>
                                                <input type="text" name="observaciones" class="form-control form-control-sm" placeholder="Notas sobre evolución..." style="font-size: 0.75rem;">
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-end gap-1.5">
                                            <button type="button" class="btn btn-secondary btn-sm py-0.5 px-2 btn-cancel-form" style="font-size: 0.7rem;">Cancelar</button>
                                            <button type="submit" class="btn btn-primary btn-sm py-0.5 px-2.5" style="font-size: 0.7rem;">Guardar</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <!-- ACCORDION: FARMACOLÓGICOS (MedicationStatement) -->
                        <div class="accordion-item border rounded mb-2 overflow-hidden shadow-sm bg-white" data-accordion="farmacologicos">
                            <h2 class="accordion-header" id="headingFarmacologicosFHIR">
                                <button class="accordion-button collapsed py-2.5 px-3 bg-light text-dark fw-bold fs-8 d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFarmacologicosFHIR" aria-expanded="false" aria-controls="collapseFarmacologicosFHIR">
                                    <i class="bi bi-capsule text-success me-2 fs-6"></i>
                                    <span class="me-1.5">Farmacológicos Habituales</span>
                                    <span class="badge bg-secondary rounded-pill font-monospace count-badge me-1.5" style="font-size: 0.65rem;">0</span>
                                    <span class="badge bg-emerald bg-opacity-10 text-success border border-success border-opacity-20 uppercase font-semibold scale-90" style="font-size: 0.55rem; padding: 0.15rem 0.25rem; background-color: rgba(25, 135, 84, 0.1) !important; color: #198754 !important;">MedicationStatement</span>
                                </button>
                            </h2>
                            <div id="collapseFarmacologicosFHIR" class="accordion-collapse collapse" aria-labelledby="headingFarmacologicosFHIR" data-bs-parent="#accordionAntecedentesFHIR">
                                <div class="accordion-body p-2.5 bg-white">
                                    <!-- Add Button -->
                                    <div class="d-flex justify-content-end mb-2">
                                        <button type="button" class="btn btn-outline-primary btn-sm py-0.5 px-2 btn-add-form" data-type="farmacologicos" style="font-size: 0.7rem; font-weight: 600;">
                                            <i class="bi bi-plus-circle me-1"></i>Añadir
                                        </button>
                                    </div>
                                    
                                    <!-- Items List -->
                                    <div class="items-list list-group list-group-flush mb-2 border rounded" id="list-farmacologicos"></div>
                                    
                                    <!-- Micro Form -->
                                    <form class="hidden-form d-none bg-light border border-secondary border-opacity-15 rounded p-2.5 mb-1" id="form-farmacologicos">
                                        <div class="row g-2 mb-2">
                                            <div class="col-8">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Medicamento / Principio Activo</label>
                                                <input type="text" name="medicamento" class="form-control form-control-sm" placeholder="Ej: Losartán 50mg" style="font-size: 0.75rem;" required>
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Código</label>
                                                <input type="text" name="codigo" class="form-control form-control-sm font-monospace text-uppercase" placeholder="CUM/ATC" style="font-size: 0.75rem;">
                                            </div>
                                            <div class="col-8">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Dosificación y Frecuencia</label>
                                                <input type="text" name="dosificacion" class="form-control form-control-sm" placeholder="Ej: 1 tableta cada 24 horas" style="font-size: 0.75rem;" required>
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Estado</label>
                                                <select name="status" class="form-select form-select-sm" style="font-size: 0.75rem;">
                                                    <option value="active" selected>Activo</option>
                                                    <option value="completed">Completado</option>
                                                    <option value="stopped">Suspendido</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-end gap-1.5">
                                            <button type="button" class="btn btn-secondary btn-sm py-0.5 px-2 btn-cancel-form" style="font-size: 0.7rem;">Cancelar</button>
                                            <button type="submit" class="btn btn-primary btn-sm py-0.5 px-2.5" style="font-size: 0.7rem;">Guardar</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <!-- ACCORDION: FAMILIARES (FamilyMemberHistory) -->
                        <div class="accordion-item border rounded mb-2 overflow-hidden shadow-sm bg-white" data-accordion="familiares">
                            <h2 class="accordion-header" id="headingFamiliaresFHIR">
                                <button class="accordion-button collapsed py-2.5 px-3 bg-light text-dark fw-bold fs-8 d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFamiliaresFHIR" aria-expanded="false" aria-controls="collapseFamiliaresFHIR">
                                    <i class="bi bi-people text-info me-2 fs-6"></i>
                                    <span class="me-1.5">Familiares</span>
                                    <span class="badge bg-secondary rounded-pill font-monospace count-badge me-1.5" style="font-size: 0.65rem;">0</span>
                                    <span class="badge bg-sky bg-opacity-10 text-sky border border-sky border-opacity-20 uppercase font-semibold scale-90" style="font-size: 0.55rem; padding: 0.15rem 0.25rem; background-color: rgba(13, 202, 240, 0.1) !important; color: #0dcaf0 !important;">FamilyMemberHistory</span>
                                </button>
                            </h2>
                            <div id="collapseFamiliaresFHIR" class="accordion-collapse collapse" aria-labelledby="headingFamiliaresFHIR" data-bs-parent="#accordionAntecedentesFHIR">
                                <div class="accordion-body p-2.5 bg-white">
                                    <!-- Add Button -->
                                    <div class="d-flex justify-content-end mb-2">
                                        <button type="button" class="btn btn-outline-primary btn-sm py-0.5 px-2 btn-add-form" data-type="familiares" style="font-size: 0.7rem; font-weight: 600;">
                                            <i class="bi bi-plus-circle me-1"></i>Añadir
                                        </button>
                                    </div>
                                    
                                    <!-- Items List -->
                                    <div class="items-list list-group list-group-flush mb-2 border rounded" id="list-familiares"></div>
                                    
                                    <!-- Micro Form -->
                                    <form class="hidden-form d-none bg-light border border-secondary border-opacity-15 rounded p-2.5 mb-1" id="form-familiares">
                                        <div class="row g-2 mb-2">
                                            <div class="col-6">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Parentesco</label>
                                                <select name="parentesco" class="form-select form-select-sm" style="font-size: 0.75rem;">
                                                    <option value="FTH" selected>Padre</option>
                                                    <option value="MTH">Madre</option>
                                                    <option value="SIB">Hermano/a</option>
                                                    <option value="GRFTH">Abuelo/a</option>
                                                    <option value="UNC">Tío/a</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Diagnóstico (Descripción)</label>
                                                <input type="text" name="descripcion" class="form-control form-control-sm" placeholder="Ej: Diabetes Tipo II" style="font-size: 0.75rem;" required>
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Código CIE-10</label>
                                                <input type="text" name="codigo" class="form-control form-control-sm font-monospace text-uppercase" placeholder="Ej: E11" style="font-size: 0.75rem;">
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Edad Diag.</label>
                                                <input type="number" name="edad" class="form-control form-control-sm" placeholder="Años" style="font-size: 0.75rem;">
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Estado</label>
                                                <select name="estado" class="form-select form-select-sm" style="font-size: 0.75rem;">
                                                    <option value="completed" selected>Completado</option>
                                                    <option value="partial">Parcial</option>
                                                </select>
                                            </div>
                                            <div class="col-12">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Observaciones</label>
                                                <input type="text" name="observaciones" class="form-control form-control-sm" placeholder="Notas adicionales..." style="font-size: 0.75rem;">
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-end gap-1.5">
                                            <button type="button" class="btn btn-secondary btn-sm py-0.5 px-2 btn-cancel-form" style="font-size: 0.7rem;">Cancelar</button>
                                            <button type="submit" class="btn btn-primary btn-sm py-0.5 px-2.5" style="font-size: 0.7rem;">Guardar</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <!-- ACCORDION: ALERGIAS (AllergyIntolerance) -->
                        <div class="accordion-item border rounded mb-2 overflow-hidden shadow-sm bg-white" data-accordion="alergias">
                            <h2 class="accordion-header" id="headingAlergiasFHIR">
                                <button class="accordion-button collapsed py-2.5 px-3 bg-light text-dark fw-bold fs-8 d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAlergiasFHIR" aria-expanded="false" aria-controls="collapseAlergiasFHIR">
                                    <i class="bi bi-exclamation-triangle text-warning me-2 fs-6"></i>
                                    <span class="me-1.5">Alergias Críticas</span>
                                    <span class="badge bg-secondary rounded-pill font-monospace count-badge me-1.5" style="font-size: 0.65rem;">0</span>
                                    <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-20 uppercase font-semibold scale-90" style="font-size: 0.55rem; padding: 0.15rem 0.25rem; background-color: rgba(255, 193, 7, 0.1) !important; color: #ffc107 !important;">AllergyIntolerance</span>
                                </button>
                            </h2>
                            <div id="collapseAlergiasFHIR" class="accordion-collapse collapse" aria-labelledby="headingAlergiasFHIR" data-bs-parent="#accordionAntecedentesFHIR">
                                <div class="accordion-body p-2.5 bg-white">
                                    <!-- Add Button -->
                                    <div class="d-flex justify-content-end mb-2">
                                        <button type="button" class="btn btn-outline-primary btn-sm py-0.5 px-2 btn-add-form" data-type="alergias" style="font-size: 0.7rem; font-weight: 600;">
                                            <i class="bi bi-plus-circle me-1"></i>Añadir
                                        </button>
                                    </div>
                                    
                                    <!-- Items List -->
                                    <div class="items-list list-group list-group-flush mb-2 border rounded" id="list-alergias"></div>
                                    
                                    <!-- Micro Form -->
                                    <form class="hidden-form d-none bg-light border border-secondary border-opacity-15 rounded p-2.5 mb-1" id="form-alergias">
                                        <div class="row g-2 mb-2">
                                            <div class="col-6">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Tipo de Alergia</label>
                                                <select name="tipoalergia" class="form-select form-select-sm" style="font-size: 0.75rem;" required>
                                                    <option value="" disabled selected>Seleccione...</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Sustancia / Alérgeno</label>
                                                <input type="text" name="sustancia" class="form-control form-control-sm" placeholder="Ej: Penicilina" style="font-size: 0.75rem;" required>
                                            </div>
                                        </div>
                                        <div class="row g-2 mb-2">
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Estado Clínico</label>
                                                <select name="clinicalStatus" class="form-select form-select-sm" style="font-size: 0.75rem;" required>
                                                    <option value="active" selected>Activo</option>
                                                </select>
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Verificación</label>
                                                <select name="verificationStatus" class="form-select form-select-sm" style="font-size: 0.75rem;" required>
                                                    <option value="confirmed" selected>Confirmado</option>
                                                </select>
                                            </div>
                                            <div class="col-4">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Criticidad</label>
                                                <select name="criticality" class="form-select form-select-sm" style="font-size: 0.75rem;">
                                                    <option value="low">Baja</option>
                                                    <option value="high" selected>Alta</option>
                                                    <option value="unable-to-assess">No Eval.</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="row g-2 mb-2">
                                            <div class="col-12">
                                                <label class="form-label text-secondary mb-0.5 small" style="font-size: 0.7rem; font-weight: 500;">Observaciones</label>
                                                <input type="text" name="observaciones" class="form-control form-control-sm" placeholder="Notas sobre la reacción..." style="font-size: 0.75rem;">
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-end gap-1.5">
                                            <button type="button" class="btn btn-secondary btn-sm py-0.5 px-2 btn-cancel-form" style="font-size: 0.7rem;">Cancelar</button>
                                            <button type="submit" class="btn btn-primary btn-sm py-0.5 px-2.5" style="font-size: 0.7rem;">Guardar</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

                <!-- Footer -->
                <div class="p-3 bg-white border-t d-flex align-items-center justify-content-between text-muted shadow-sm" style="font-size: 0.65rem;">
                    <span class="d-flex align-items-center">
                        <span class="w-2 h-2 rounded-circle bg-success me-1.5 d-inline-block animate-pulse" style="width: 8px; height: 8px;"></span>
                        Estado FHIR: Conectado
                    </span>
                    <span class="font-monospace text-slate-400">HL7 v4.0.1</span>
                </div>
            </div>
        `;

        this.mountElement.appendChild(wrapper);

        // Referencias del DOM usando las clases de Bootstrap
        this.drawerElement = wrapper.querySelector('#offcanvasAntecedentesFHIR');
        
        // Inicializar Instancia de Offcanvas nativo de Bootstrap 5
        this.offcanvasInstance = new bootstrap.Offcanvas(this.drawerElement);

        this.bindEvents();
    }

    /**
     * Vincula event listeners para interactividad y visualización.
     */
    bindEvents() {
        // Escuchar el evento de cierre nativo de Bootstrap para disparar callbacks y resetear
        this.drawerElement.addEventListener('hidden.bs.offcanvas', () => {
            this.state.ui.isOpen = false;
            
            // Ocultar micro-formularios abiertos y resetear
            const forms = this.drawerElement.querySelectorAll('.hidden-form');
            forms.forEach(form => {
                form.classList.add('d-none');
                form.reset();
            });

            if (this.onClose) this.onClose();
        });

        // Formularios: Abrir / Mostrar
        const addButtons = this.drawerElement.querySelectorAll('.btn-add-form');
        addButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar comportamientos del disparador
                const type = btn.getAttribute('data-type');
                const accordionItem = this.drawerElement.querySelector(`[data-accordion="${type}"]`);
                const form = accordionItem.querySelector('.hidden-form');

                // Mostrar formulario removiendo d-none de Bootstrap
                form.classList.remove('d-none');
            });
        });

        // Formularios: Cancelar / Ocultar
        const cancelButtons = this.drawerElement.querySelectorAll('.btn-cancel-form');
        cancelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const form = btn.closest('.hidden-form');
                form.classList.add('d-none');
                form.reset();
            });
        });

        // Formularios: Envíos (Guardar)
        const forms = this.drawerElement.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formId = form.id;
                const type = formId.replace('form-', '');
                await this.handleFormSubmit(type, form);
            });
        });
    }

    /**
     * Abre el Drawer cargando datos para el paciente indicado.
     * @param {string} pacienteId
     * @param {string} patientName
     * @param {Object} [data] - Datos iniciales de antecedentes en formato plano o cargados en memoria.
     */
    open(pacienteId, patientName, data = null) {
        this.state.pacienteId = pacienteId;
        this.state.patientName = patientName;
        
        this.drawerElement.querySelector('#drawer-patient-id').textContent = pacienteId;
        this.drawerElement.querySelector('#drawer-patient-name').textContent = patientName;

        if (data) {
            this.state.data = {
                conditions: data.conditions || [],
                medications: data.medications || [],
                familyHistory: data.familyHistory || [],
                allergies: data.allergies || []
            };
        }

        // Render de listas e insignias de contador
        this.renderLists();

        // Mostrar Offcanvas llamando al API nativa de Bootstrap 5
        this.offcanvasInstance.show();
        this.state.ui.isOpen = true;
    }

    /**
     * Cierra el Drawer programáticamente.
     */
    close() {
        this.offcanvasInstance.hide();
    }

    /**
     * Permite actualizar datos de antecedentes sin reiniciar o cerrar formularios abiertos.
     * @param {Object} data
     */
    setData(data) {
        this.state.data = {
            conditions: data.conditions || [],
            medications: data.medications || [],
            familyHistory: data.familyHistory || [],
            allergies: data.allergies || []
        };
        this.renderLists();
    }

    /**
     * Callback de envío a guardar y formateo de Payload en esquema HL7 FHIR
     */
    async handleFormSubmit(type, formElement) {
        const formData = new FormData(formElement);
        let fhirResource = {};
        let localData = null;
        const timestamp = new Date().toISOString();

        if (type === 'patologicos') {
            const descripcion = formData.get('descripcion').trim();
            const codigo = (formData.get('codigo') || '').trim();
            const clinicalStatus = formData.get('clinicalStatus');
            const verificationStatus = formData.get('verificationStatus');
            const edad = formData.get('edad') ? parseInt(formData.get('edad'), 10) : null;
            const observaciones = (formData.get('observaciones') || '').trim() || null;

            // Formatear Recurso FHIR: Condition
            fhirResource = {
                resourceType: "Condition",
                id: `condition-temp-${Date.now()}`,
                clinicalStatus: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        code: clinicalStatus
                    }]
                },
                verificationStatus: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        code: verificationStatus
                    }]
                },
                code: {
                    coding: codigo ? [{
                        system: "http://hl7.org/fhir/sid/icd-10",
                        code: codigo,
                        display: descripcion
                    }] : [],
                    text: descripcion
                },
                subject: {
                    reference: `Patient/${this.state.pacienteId}`
                },
                recordedDate: timestamp,
                note: observaciones ? [{ text: observaciones }] : [],
                onsetAge: edad !== null ? {
                    value: edad,
                    unit: "a del diag.",
                    system: "http://unitsofmeasure.org",
                    code: "a"
                } : null
            };

            // Preparar datos locales
            localData = {
                id: fhirResource.id,
                code: codigo || 'S/C',
                description: descripcion,
                clinicalStatus: clinicalStatus,
                verificationStatus: verificationStatus,
                recordedDate: timestamp.split('T')[0],
                edad: edad,
                observaciones: observaciones
            };

        } else if (type === 'farmacologicos') {
            const medicamento = formData.get('medicamento').trim();
            const status = formData.get('status');
            const dosificacion = formData.get('dosificacion').trim();
            const codigo = (formData.get('codigo') || '').trim();

            // Formatear Recurso FHIR: MedicationStatement
            fhirResource = {
                resourceType: "MedicationStatement",
                id: `medication-temp-${Date.now()}`,
                status: status,
                medicationCodeableConcept: {
                    coding: codigo ? [{
                        system: "http://hl7.org/fhir/sid/ndc",
                        code: codigo,
                        display: medicamento
                    }] : [],
                    text: medicamento
                },
                subject: {
                    reference: `Patient/${this.state.pacienteId}`
                },
                dosage: [{
                    text: dosificacion
                }],
                dateAsserted: timestamp
            };

            // Preparar datos locales
            localData = {
                id: fhirResource.id,
                medication: medicamento,
                status: status,
                dosage: dosificacion,
                effectiveDate: timestamp.split('T')[0],
                code: codigo || 'S/C'
            };

        } else if (type === 'familiares') {
            const parentesco = formData.get('parentesco');
            const descripcion = formData.get('descripcion').trim();
            const codigo = (formData.get('codigo') || '').trim();
            const edad = formData.get('edad') ? parseInt(formData.get('edad'), 10) : null;
            const estado = formData.get('estado');
            const observaciones = (formData.get('observaciones') || '').trim() || null;

            const selectEl = formElement.querySelector('select[name="parentesco"]');
            const parentescoText = selectEl ? selectEl.options[selectEl.selectedIndex].text : parentesco;

            // Formatear Recurso FHIR: FamilyMemberHistory
            fhirResource = {
                resourceType: "FamilyMemberHistory",
                id: `family-temp-${Date.now()}`,
                status: estado || "completed",
                patient: {
                    reference: `Patient/${this.state.pacienteId}`
                },
                relationship: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                        code: parentesco,
                        display: parentescoText
                    }],
                    text: parentescoText
                },
                condition: [{
                    code: {
                        coding: codigo ? [{
                            system: "http://hl7.org/fhir/sid/icd-10",
                            code: codigo,
                            display: descripcion
                        }] : [],
                        text: descripcion
                    },
                    note: observaciones ? [{ text: observaciones }] : [],
                    onsetAge: edad !== null ? {
                        value: edad,
                        unit: "a del diag.",
                        system: "http://unitsofmeasure.org",
                        code: "a"
                    } : null
                }]
            };

            // Preparar datos locales
            localData = {
                id: fhirResource.id,
                relationship: parentescoText,
                condition: descripcion,
                status: estado || "completed",
                code: codigo || 'S/C',
                edad: edad,
                observaciones: observaciones
            };

        } else if (type === 'alergias') {
            const sustancia = formData.get('sustancia').trim();
            const criticality = formData.get('criticality');
            const tipoalergia = formData.get('tipoalergia');
            const clinicalStatus = formData.get('clinicalStatus');
            const verificationStatus = formData.get('verificationStatus');
            const observaciones = (formData.get('observaciones') || '').trim() || null;

            const selectEl = formElement.querySelector('select[name="tipoalergia"]');
            const tipoalergiaText = selectEl ? selectEl.options[selectEl.selectedIndex].text : tipoalergia;

            // Formatear Recurso FHIR: AllergyIntolerance
            fhirResource = {
                resourceType: "AllergyIntolerance",
                id: `allergy-temp-${Date.now()}`,
                clinicalStatus: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                        code: clinicalStatus
                    }]
                },
                verificationStatus: {
                    coding: [{
                        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                        code: verificationStatus
                    }]
                },
                criticality: criticality,
                type: tipoalergia,
                code: {
                    text: sustancia
                },
                patient: {
                    reference: `Patient/${this.state.pacienteId}`
                },
                recordedDate: timestamp,
                note: observaciones ? [{ text: observaciones }] : []
            };

            // Preparar datos locales
            localData = {
                id: fhirResource.id,
                substance: sustancia,
                criticality: criticality,
                type: tipoalergia,
                tipo_alergia_nombre: tipoalergiaText,
                clinicalStatus: clinicalStatus,
                verificationStatus: verificationStatus,
                observaciones: observaciones
            };
        }

        // Notificar al controlador principal mediante callback y esperar confirmación
        let saveSuccess = true;
        if (this.onSave) {
            try {
                const res = await this.onSave(fhirResource.resourceType, fhirResource);
                if (res === false) {
                    saveSuccess = false;
                }
            } catch (err) {
                console.error("Error in onSave callback:", err);
                saveSuccess = false;
            }
        }

        // Guardar localmente y actualizar interfaz solo si se guardó correctamente en base de datos
        if (saveSuccess) {
            if (type === 'patologicos') {
                this.state.data.conditions.push(localData);
            } else if (type === 'farmacologicos') {
                this.state.data.medications.push(localData);
            } else if (type === 'familiares') {
                this.state.data.familyHistory.push(localData);
            } else if (type === 'alergias') {
                this.state.data.allergies.push(localData);
            }

            // Re-renderizar lista modificada e insignias de contador
            this.renderLists();

            // Ocultar y vaciar formulario
            formElement.classList.add('d-none');
            formElement.reset();
        }
    }

    /**
     * Renderiza únicamente las listas de registros en el DOM usando Bootstrap 5 List Group.
     * Mantiene intacto cualquier formulario abierto y evita pérdida de foco.
     */
    renderLists() {
        // 1. Patológicos
        const listCond = this.drawerElement.querySelector('#list-patologicos');
        const badgeCond = this.drawerElement.querySelector('[data-accordion="patologicos"] .count-badge');
        badgeCond.textContent = this.state.data.conditions.length;
        
        if (this.state.data.conditions.length === 0) {
            listCond.innerHTML = `<div class="p-2 text-center text-muted italic bg-light" style="font-size: 0.72rem;">Sin antecedentes patológicos registrados</div>`;
        } else {
            listCond.innerHTML = this.state.data.conditions.map(c => {
                let badgeClass = 'bg-danger';
                let statusLabel = 'Activo';
                if (c.clinicalStatus === 'resolved') {
                    badgeClass = 'bg-success';
                    statusLabel = 'Resuelto';
                } else if (c.clinicalStatus === 'inactive') {
                    badgeClass = 'bg-secondary';
                    statusLabel = 'Inactivo';
                }
                
                return `
                    <div class="list-group-item p-2 d-flex flex-column gap-1 bg-white border-bottom">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-semibold text-dark" style="font-size: 0.75rem;">${c.description}</span>
                            <span class="badge ${badgeClass} bg-opacity-10 text-dark border border-${badgeClass.substring(3)} border-opacity-25" style="font-size: 0.62rem; padding: 0.15rem 0.3rem;">
                                ${statusLabel}
                            </span>
                        </div>
                        
                        <div class="text-muted small" style="font-size: 0.68rem; line-height: 1.3;">
                            <span class="text-secondary">Diagnosticado a los:</span> ${c.edad ? `${c.edad} años` : '--'}.
                            ${c.observaciones ? `<span class="ms-1 text-secondary">Obs:</span> ${c.observaciones}` : ''}
                        </div>

                        <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 0.68rem;">
                            <span class="font-monospace bg-light border rounded px-1" style="font-size: 0.65rem;">
                                <i class="bi bi-tag-fill me-0.5 text-secondary"></i>${c.code}
                            </span>
                            <div class="d-flex align-items-center gap-1.5">
                                <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20" style="font-size: 0.62rem; padding: 0.12rem 0.25rem;">
                                    ${(c.verificationStatus === 'confirmed' || c.verificationStatus === 'confirmado') ? 'Confirmado' : 'Sin Confirmar'}
                                </span>
                                <span class="font-monospace text-slate-400" style="font-size: 0.62rem;">${c.recordedDate}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 2. Farmacológicos
        const listMeds = this.drawerElement.querySelector('#list-farmacologicos');
        const badgeMeds = this.drawerElement.querySelector('[data-accordion="farmacologicos"] .count-badge');
        badgeMeds.textContent = this.state.data.medications.length;

        if (this.state.data.medications.length === 0) {
            listMeds.innerHTML = `<div class="p-2 text-center text-muted italic bg-light" style="font-size: 0.72rem;">Sin tratamientos habituales registrados</div>`;
        } else {
            listMeds.innerHTML = this.state.data.medications.map(m => {
                let badgeClass = 'bg-success';
                let statusLabel = 'Activo';
                if (m.status === 'completed') {
                    badgeClass = 'bg-secondary';
                    statusLabel = 'Completo';
                } else if (m.status === 'stopped') {
                    badgeClass = 'bg-warning';
                    statusLabel = 'Suspend.';
                }

                return `
                    <div class="list-group-item p-2 d-flex flex-column gap-1 bg-white border-bottom">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-semibold text-dark" style="font-size: 0.75rem;">
                                <i class="bi bi-capsule text-success me-1"></i>${m.medication}
                            </span>
                            <span class="badge ${badgeClass} bg-opacity-10 text-dark border border-${badgeClass.substring(3)} border-opacity-25" style="font-size: 0.62rem; padding: 0.15rem 0.3rem;">
                                ${statusLabel}
                            </span>
                        </div>
                        <div class="text-secondary bg-light border rounded p-1 italic mb-0.5" style="font-size: 0.7rem;">
                            Dosificación: <strong>${m.dosage}</strong>
                        </div>
                        <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 0.68rem;">
                            <span class="font-monospace bg-light border rounded px-1" style="font-size: 0.65rem;">
                                <i class="bi bi-tag-fill me-0.5 text-secondary"></i>${m.code || 'S/C'}
                            </span>
                            <span class="font-monospace text-slate-400" style="font-size: 0.62rem;">Asertado: ${m.effectiveDate}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 3. Familiares
        const listFam = this.drawerElement.querySelector('#list-familiares');
        const badgeFam = this.drawerElement.querySelector('[data-accordion="familiares"] .count-badge');
        badgeFam.textContent = this.state.data.familyHistory.length;

        if (this.state.data.familyHistory.length === 0) {
            listFam.innerHTML = `<div class="p-2 text-center text-muted italic bg-light" style="font-size: 0.72rem;">Sin historial familiar reportado</div>`;
        } else {
            listFam.innerHTML = this.state.data.familyHistory.map(f => {
                let statusClass = 'bg-secondary';
                let statusDisplay = f.status || 'Completado';
                if (f.status === 'completed') {
                    statusClass = 'bg-success';
                    statusDisplay = 'Completo';
                }

                return `
                    <div class="list-group-item p-2 d-flex flex-column gap-1 bg-white border-bottom">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style="font-size: 0.7rem; padding: 0.15rem 0.3rem;">
                                    ${f.relationship}
                                </span>
                                <span class="fw-semibold text-dark" style="font-size: 0.75rem;">${f.condition}</span>
                            </div>
                            <span class="badge ${statusClass} bg-opacity-10 text-dark border border-${statusClass.substring(3)} border-opacity-25" style="font-size: 0.62rem; padding: 0.15rem 0.3rem;">
                                ${statusDisplay}
                            </span>
                        </div>

                        ${(f.edad || f.observaciones) ? `
                        <div class="text-muted small mt-0.5" style="font-size: 0.68rem; line-height: 1.3;">
                            ${f.edad ? `<span class="text-secondary">Diagnosticado a los:</span> ${f.edad} años.` : ''}
                            ${f.observaciones ? `<span class="ms-1 text-secondary">Obs:</span> ${f.observaciones}` : ''}
                        </div>
                        ` : ''}

                        <div class="d-flex justify-content-between align-items-center text-muted mt-0.5" style="font-size: 0.68rem;">
                            <span class="font-monospace bg-light border rounded px-1" style="font-size: 0.65rem;">
                                <i class="bi bi-tag-fill me-0.5 text-secondary"></i>${f.code || 'S/C'}
                            </span>
                            <span class="font-monospace text-slate-400" style="font-size: 0.62rem;">FHIR Record</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 4. Alergias
        const listAle = this.drawerElement.querySelector('#list-alergias');
        const badgeAle = this.drawerElement.querySelector('[data-accordion="alergias"] .count-badge');
        badgeAle.textContent = this.state.data.allergies.length;

        if (this.state.data.allergies.length === 0) {
            listAle.innerHTML = `<div class="p-2 text-center text-muted italic bg-light" style="font-size: 0.72rem;">Sin alertas de alergias críticas</div>`;
        } else {
            listAle.innerHTML = this.state.data.allergies.map(a => {
                const badgeClass = a.criticality === 'high' ? 'bg-danger' : 'bg-warning';
                const label = a.criticality === 'high' ? 'Alta' : (a.criticality === 'low' ? 'Baja' : 'No Eval.');
                
                let stateClass = 'bg-secondary';
                let stateLabel = a.estado_clinico_display || (a.clinicalStatus === 'active' ? 'Activo' : a.clinicalStatus);
                if (a.clinicalStatus === 'active') {
                    stateClass = 'bg-success';
                }
                
                let verifLabel = a.verificacion_display || (a.verificationStatus === 'confirmed' ? 'Confirmado' : a.verificationStatus);

                return `
                    <div class="list-group-item p-2 d-flex flex-column gap-1 bg-white border-bottom">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25" style="font-size: 0.7rem; padding: 0.15rem 0.3rem;">
                                    ${a.tipo_alergia_nombre || 'Alergia'}
                                </span>
                                <span class="fw-semibold text-dark" style="font-size: 0.75rem;">${a.substance}</span>
                            </div>
                            <span class="badge ${stateClass} bg-opacity-10 text-dark border border-${stateClass.substring(3)} border-opacity-25" style="font-size: 0.62rem; padding: 0.15rem 0.3rem;">
                                ${stateLabel}
                            </span>
                        </div>
                        
                        ${a.observaciones ? `
                        <div class="text-muted small mt-0.5" style="font-size: 0.68rem; line-height: 1.3;">
                            <span class="text-secondary">Obs:</span> ${a.observaciones}
                        </div>
                        ` : ''}

                        <div class="d-flex justify-content-between align-items-center text-muted mt-0.5" style="font-size: 0.68rem;">
                            <span class="badge ${badgeClass} bg-opacity-10 text-dark border border-${badgeClass.substring(3)} border-opacity-25" style="font-size: 0.62rem; padding: 0.12rem 0.25rem;">
                                Criticidad: ${label}
                            </span>
                            <div class="d-flex align-items-center gap-1.5">
                                <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20" style="font-size: 0.62rem; padding: 0.12rem 0.25rem;">
                                    ${verifLabel}
                                </span>
                                <span class="font-monospace text-slate-400" style="font-size: 0.62rem;">FHIR Record</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}
